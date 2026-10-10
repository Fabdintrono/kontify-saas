# Kontify — Fase A «Confianza» — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el usuario confíe en lo que ve: fechas y períodos en la hora de su empresa, estado de pago visible en ventas (Pagada / Parcial / Pendiente / Vencida), confirmación antes de anular/eliminar/archivar, aviso de éxito tras cada acción y la tarjeta «Requieren atención» del dashboard con datos reales.

**Architecture:** Zona horaria por empresa (`tenants.timezone`) + helpers puros en `src/lib/tz.ts`; toda consulta que filtra por fecha recibe `tz` y convierte «día local» → instante UTC. Estado de pago derivado por una función pura (`paymentStatusOf`) que usan lista, detalle y badge. Confirmaciones con un `ConfirmDialog` (Radix Dialog + `useTransition`, nunca `confirm()` nativo porque la PWA lo suprime). Toasts con un provider propio montado en `AppShell`; las acciones que redirigen pasan `?flash=clave` y un `FlashToast` lo muestra; las que no redirigen disparan el toast desde el cliente.

**Tech Stack:** Next 16 App Router (Server Actions, `proxy.ts`), React 19, Tailwind 4 (`@custom-variant dark`), Supabase local (Postgres + RLS), Radix Dialog/Popover, Zod 4, Vitest 4 (+ jsdom y @testing-library/react para componentes), Lucide.

---

## Convenciones para quien implemente

- **Rama:** `feat/ux-fase-a` desde `master`. Un commit por tarea (mensajes en español, estilo `feat(ventas): …`, `fix(...)`, `test(...)`).
- **Tests:** `npx vitest run <archivo>` para uno; `npx vitest run` para todos (~30 s; corren en serie contra Supabase local, que ya está arriba en Docker: API 54321, DB 54322). Tests de componente llevan `// @vitest-environment jsdom` en la primera línea.
- **Migración local:** el CLI de Supabase no está instalado. Aplicar así (registra la versión como lo haría `supabase migration up`):
  ```bash
  docker exec -i supabase_db_admin-saas psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/migrations/0027_tenant_timezone.sql
  docker exec supabase_db_admin-saas psql -U postgres -d postgres -c "insert into supabase_migrations.schema_migrations(version, name, statements) values ('0027','tenant_timezone','{}')"
  ```
- **Typecheck:** `npx tsc --noEmit` (no hay script `typecheck`). **Build:** `npm run build`.
- **Next 16:** leer `node_modules/next/dist/docs/` ante cualquier duda de API; `params`/`searchParams` son Promises; el middleware se llama `proxy`.
- **Estilo:** tokens `var(--bg) var(--surface) var(--border) var(--text) var(--text-soft)`; primario `#0e7490`, gradiente `from-[#0e7490] to-[#14b8a6]`; peligro `#dc2626`; alerta `#b45309` (dark `#fbbf24`); éxito `#0f766e` (dark `#6ee7b7`). Iconos Lucide, sin emojis.
- **Nunca** `confirm()`, `alert()`, `prompt()` nativos.
- Los textos visibles van en español neutro, sin «plata».

---

### Task 1: Rama, migración `tenants.timezone` y `getTenantSettings`

**Files:**
- Create: `supabase/migrations/0027_tenant_timezone.sql`
- Create: `src/lib/tenant.ts`
- Modify: `src/lib/productos/queries.ts:63-69`
- Test: `tests/tenant.test.ts`

- [ ] **Step 1: Crear la rama**

```bash
git checkout -b feat/ux-fase-a master
```

- [ ] **Step 2: Escribir el test que falla**

`tests/tenant.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import { getTenantSettings } from "@/lib/tenant";
import { getTenantCurrency } from "@/lib/productos/queries";

async function makeTenant(name: string) {
  const u = await newUserClient();
  const { data: tenantId } = await u.client.rpc("bootstrap_tenant", {
    p_name: name, p_slug: `${name}-${Date.now()}-${Math.random()}`, p_full_name: name,
  });
  return { ...u, tenantId: tenantId as string };
}

describe("getTenantSettings", () => {
  it("devuelve moneda y zona horaria con defaults USD / America/Caracas", async () => {
    const t = await makeTenant("tz");
    const s = await getTenantSettings(t.client);
    expect(s.currency).toBe("USD");
    expect(s.timezone).toBe("America/Caracas");
  });
  it("respeta la zona guardada en la empresa (el owner puede editarla)", async () => {
    const t = await makeTenant("tz2");
    const { error } = await t.client.from("tenants").update({ timezone: "America/Bogota" }).eq("id", t.tenantId);
    expect(error).toBeNull();
    expect((await getTenantSettings(t.client)).timezone).toBe("America/Bogota");
  });
  it("getTenantCurrency sigue funcionando (compatibilidad)", async () => {
    const t = await makeTenant("tz3");
    expect(await getTenantCurrency(t.client)).toBe("USD");
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npx vitest run tests/tenant.test.ts`
Expected: FAIL — `Cannot find module '@/lib/tenant'`.

- [ ] **Step 4: Migración**

`supabase/migrations/0027_tenant_timezone.sql`:
```sql
-- 0027_tenant_timezone.sql
-- Zona horaria de la empresa (IANA). Todo rango "hoy / esta semana / este mes" y toda fecha
-- mostrada se calcula en esta zona, no en la del servidor ni en UTC.
alter table public.tenants
  add column if not exists timezone text not null default 'America/Caracas';

alter table public.tenants
  add constraint tenants_timezone_iana check (timezone ~ '^[A-Za-z_]+(/[A-Za-z_+-]+)+$' or timezone = 'UTC');
```

Aplicarla:
```bash
docker exec -i supabase_db_admin-saas psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/migrations/0027_tenant_timezone.sql
docker exec supabase_db_admin-saas psql -U postgres -d postgres -c "insert into supabase_migrations.schema_migrations(version, name, statements) values ('0027','tenant_timezone','{}')"
```
Expected: `ALTER TABLE` dos veces e `INSERT 0 1`.

- [ ] **Step 5: `src/lib/tenant.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type TenantSettings = { currency: string; timezone: string };
export const DEFAULT_TZ = "America/Caracas";

function validTz(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/** Moneda y zona horaria de la empresa del usuario. Nunca lanza: ante error devuelve defaults. */
export async function getTenantSettings(sb: SupabaseClient): Promise<TenantSettings> {
  try {
    const { data, error } = await sb.from("tenants").select("currency, timezone").maybeSingle();
    if (error || !data) return { currency: "USD", timezone: DEFAULT_TZ };
    return {
      currency: (data.currency as string) || "USD",
      timezone: validTz(data.timezone) ? data.timezone : DEFAULT_TZ,
    };
  } catch { return { currency: "USD", timezone: DEFAULT_TZ }; }
}
```

- [ ] **Step 6: `getTenantCurrency` delega**

En `src/lib/productos/queries.ts` reemplazar la función `getTenantCurrency` (líneas 63-69) por:
```ts
import { getTenantSettings } from "@/lib/tenant";

export async function getTenantCurrency(sb: SupabaseClient): Promise<string> {
  return (await getTenantSettings(sb)).currency;
}
```
(El `import` va arriba del archivo con los demás.)

- [ ] **Step 7: Correr el test y verificar que pasa**

Run: `npx vitest run tests/tenant.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0027_tenant_timezone.sql src/lib/tenant.ts src/lib/productos/queries.ts tests/tenant.test.ts
git commit -m "feat(tenant): zona horaria por empresa (tenants.timezone) + getTenantSettings"
```

---

### Task 2: Helpers puros de zona horaria `src/lib/tz.ts`

**Files:**
- Create: `src/lib/tz.ts`
- Test: `tests/tz.test.ts`

- [ ] **Step 1: Escribir el test que falla**

`tests/tz.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { localDateISO, startOfDayUTC, addDaysISO, rangeToInstants, todayISO } from "@/lib/tz";

const VE = "America/Caracas"; // UTC-4 todo el año

describe("tz helpers", () => {
  it("localDateISO: 03:56Z del 10/10 es todavía el 9/10 en Venezuela", () => {
    expect(localDateISO(new Date("2026-10-10T03:56:01Z"), VE)).toBe("2026-10-09");
    expect(localDateISO(new Date("2026-10-10T04:00:00Z"), VE)).toBe("2026-10-10");
    expect(localDateISO(new Date("2026-10-10T03:56:01Z"), "UTC")).toBe("2026-10-10");
  });
  it("startOfDayUTC: medianoche local → instante UTC", () => {
    expect(startOfDayUTC("2026-10-09", VE)).toBe("2026-10-09T04:00:00.000Z");
    expect(startOfDayUTC("2026-10-09", "UTC")).toBe("2026-10-09T00:00:00.000Z");
    expect(startOfDayUTC("2026-01-01", "Asia/Tokyo")).toBe("2025-12-31T15:00:00.000Z");
  });
  it("startOfDayUTC respeta el cambio de horario (Nueva York, 8 de marzo 2026)", () => {
    expect(startOfDayUTC("2026-03-08", "America/New_York")).toBe("2026-03-08T05:00:00.000Z"); // EST
    expect(startOfDayUTC("2026-03-09", "America/New_York")).toBe("2026-03-09T04:00:00.000Z"); // EDT
  });
  it("addDaysISO suma días sin depender de la zona del proceso", () => {
    expect(addDaysISO("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("rangeToInstants: [from, to] en días locales → [fromInstant, toInstant) en UTC", () => {
    expect(rangeToInstants({ from: "2026-10-09", to: "2026-10-09" }, VE))
      .toEqual({ fromInstant: "2026-10-09T04:00:00.000Z", toInstant: "2026-10-10T04:00:00.000Z" });
  });
  it("todayISO usa la zona", () => {
    expect(todayISO(VE, new Date("2026-10-10T03:56:01Z"))).toBe("2026-10-09");
  });
});
```

(Más casos —salto de horario, retroceso, desfases no enteros, guardas— se añadieron en la revisión; ver tests/tz.test.ts.)

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/tz.test.ts`
Expected: FAIL — `Cannot find module '@/lib/tz'`.

- [ ] **Step 3: Implementar `src/lib/tz.ts`**

```ts
// Helpers puros de zona horaria. Sin librerías: usa Intl, que trae la base de datos IANA de Node.
// Contrato:
//  - "fecha local" = string estricto "YYYY-MM-DD" en la zona de la empresa; "instante" = ISO UTC.
//  - `tz` debe ser una zona IANA válida (ya validada por getTenantSettings/validTz); una zona
//    inválida lanza RangeError. Una fecha mal formada lanza Error (nunca devuelve "NaN-NaN-NaN").
//  - Rangos: inclusivos por días locales; rangeToInstants devuelve [fromInstant, toInstant).
//  - startOfDayUTC: si la medianoche local no existe (salto de horario), el día arranca en la
//    transición; si ocurre dos veces (retroceso), toma la primera.

export type DateRange = { from: string; to: string };

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmtFor(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    fmtCache.set(tz, f); // una zona inválida lanza antes del set: la caché solo guarda zonas IANA reales
  }
  return f;
}

function partsIn(instant: Date, tz: string) {
  const o: Record<string, number> = {};
  for (const p of fmtFor(tz).formatToParts(instant)) if (p.type !== "literal") o[p.type] = Number(p.value);
  const r = { y: o.year, m: o.month, d: o.day, h: o.hour, mi: o.minute, s: o.second };
  if (![r.y, r.m, r.d, r.h, r.mi, r.s].every(Number.isFinite)) throw new Error(`No se pudo descomponer la fecha en la zona ${tz}`);
  return r;
}

/** ¿Es un "YYYY-MM-DD" real? Rechaza "2026-02-30", instantes ISO completos y basura. */
export function isDateISO(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_ISO.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (y < 1000 || y > 9999) return false; // fuera de ese rango Date.UTC remapea años y el ISO cambia de ancho
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
function assertDateISO(s: string): void {
  if (!isDateISO(s)) throw new Error(`Fecha local inválida: ${s}`);
}
const toISO = (t: Date) => `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;

/** Desfase de la zona (minutos respecto a UTC) en un instante dado. Caracas → -240. */
export function tzOffsetMinutes(instant: Date, tz: string): number {
  const p = partsIn(instant, tz);
  const asUTC = new Date(Date.UTC(p.y, p.m - 1, p.d)).getTime() + ((p.h * 60 + p.mi) * 60 + p.s) * 1000;
  return Math.round((asUTC - instant.getTime()) / 60000);
}

/** "YYYY-MM-DD" del instante en la zona. */
export function localDateISO(instant: Date, tz: string): string {
  const p = partsIn(instant, tz);
  return `${pad(p.y, 4)}-${pad(p.m)}-${pad(p.d)}`;
}

/** Hoy en la zona. `now` es inyectable para tests. */
export function todayISO(tz: string, now: Date = new Date()): string {
  return localDateISO(now, tz);
}

/** Suma días a una fecha local sin pasar por la zona del proceso. */
export function addDaysISO(dateISO: string, n: number): string {
  if (!Number.isSafeInteger(n)) throw new Error(`Desplazamiento de días inválido: ${n}`);
  assertDateISO(dateISO);
  const [y, m, d] = dateISO.split("-").map(Number);
  return toISO(new Date(Date.UTC(y, m - 1, d + n)));
}

/** Instante UTC (ISO) de la medianoche local de `dateISO` en la zona. */
export function startOfDayUTC(dateISO: string, tz: string): string {
  assertDateISO(dateISO);
  const [y, m, d] = dateISO.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d)).getTime();
  const a = guess - tzOffsetMinutes(new Date(guess), tz) * 60000;
  const b = guess - tzOffsetMinutes(new Date(a), tz) * 60000;
  // Candidatos que de verdad caen en el día pedido; si ninguno (medianoche dentro de un salto de
  // horario), el primer instante del día es la transición misma = el mayor de los dos.
  const valid = [a, b].filter((t) => localDateISO(new Date(t), tz) === dateISO);
  return new Date(valid.length ? Math.min(...valid) : Math.max(a, b)).toISOString();
}

/** Rango de días locales inclusivo → [fromInstant, toInstant) para filtrar columnas timestamptz.
 *  Un rango invertido se normaliza (from/to intercambiados) en vez de devolver vacío en silencio. */
export function rangeToInstants(range: DateRange, tz: string): { fromInstant: string; toInstant: string } {
  assertDateISO(range.from); assertDateISO(range.to);
  const [from, to] = range.from <= range.to ? [range.from, range.to] : [range.to, range.from];
  return { fromInstant: startOfDayUTC(from, tz), toInstant: startOfDayUTC(addDaysISO(to, 1), tz) };
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/tz.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tz.ts tests/tz.test.ts
git commit -m "feat(tz): helpers puros de zona horaria (día local ↔ instante UTC)"
```

---

### Task 3: `ranges.ts` calcula presets en la zona de la empresa

**Files:**
- Modify: `src/lib/reportes/ranges.ts` (reescritura completa)
- Test: `tests/ranges.test.ts`

- [ ] **Step 1: Test que falla**

`tests/ranges.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { presetRange, monthRange, weekRange, addDays } from "@/lib/reportes/ranges";

const VE = "America/Caracas";
// Viernes 9 de octubre de 2026 a las 23:56 en Venezuela (= 10/10 03:56Z)
const REF = new Date("2026-10-10T03:56:01Z");

describe("presetRange con zona horaria", () => {
  it("hoy", () => expect(presetRange("hoy", REF, VE)).toEqual({ from: "2026-10-09", to: "2026-10-09" }));
  it("semana (lunes a hoy)", () => expect(presetRange("semana", REF, VE)).toEqual({ from: "2026-10-05", to: "2026-10-09" }));
  it("mes", () => expect(presetRange("mes", REF, VE)).toEqual({ from: "2026-10-01", to: "2026-10-09" }));
  it("mes pasado", () => expect(presetRange("mes_pasado", REF, VE)).toEqual({ from: "2026-09-01", to: "2026-09-30" }));
  it("en UTC el mismo instante ya es 10/10", () => expect(presetRange("hoy", REF, "UTC")).toEqual({ from: "2026-10-10", to: "2026-10-10" }));
  it("wrappers", () => {
    expect(monthRange(REF, VE)).toEqual({ from: "2026-10-01", to: "2026-10-09" });
    expect(weekRange(REF, VE)).toEqual({ from: "2026-10-05", to: "2026-10-09" });
  });
  it("addDays sigue exportado", () => expect(addDays("2026-10-09", 1)).toBe("2026-10-10"));
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/ranges.test.ts`
Expected: FAIL — `presetRange("hoy", REF, VE)` devuelve la fecha del proceso, no `2026-10-09` (o error de aridad en TypeScript).

- [ ] **Step 3: Reescribir `src/lib/reportes/ranges.ts`**

```ts
import { addDaysISO, localDateISO, type DateRange } from "@/lib/tz";

export type { DateRange };
export type Preset = "hoy" | "semana" | "mes" | "mes_pasado";

/** Mantiene el nombre anterior; ahora valida la entrada y lanza ante basura (ver tz.ts). */
export const addDays = addDaysISO;

const startOfMonth = (dateISO: string) => `${dateISO.slice(0, 7)}-01`;
/** 0 = lunes … 6 = domingo, leído de la fecha local (no de la zona del proceso). */
const mondayIndex = (dateISO: string) => (new Date(`${dateISO}T00:00:00Z`).getUTCDay() + 6) % 7;

/** Preset → rango de días locales en la zona `tz`, tomando `ref` como "ahora". */
export function presetRange(preset: Preset, ref: Date, tz: string): DateRange {
  const today = localDateISO(ref, tz);
  switch (preset) {
    case "hoy": return { from: today, to: today };
    case "semana": return { from: addDaysISO(today, -mondayIndex(today)), to: today };
    case "mes": return { from: startOfMonth(today), to: today };
    case "mes_pasado": {
      const to = addDaysISO(startOfMonth(today), -1);
      return { from: startOfMonth(to), to };
    }
  }
}

export const monthRange = (ref: Date, tz: string): DateRange => presetRange("mes", ref, tz);
export const weekRange = (ref: Date, tz: string): DateRange => presetRange("semana", ref, tz);
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/ranges.test.ts`
Expected: PASS (7 tests). (`npx tsc --noEmit` fallará ahora en los consumidores de `monthRange`/`weekRange`: se arreglan en la Task 5.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/reportes/ranges.ts tests/ranges.test.ts
git commit -m "feat(reportes): presets de período calculados en la zona horaria de la empresa"
```

---

### Task 4: Formato de fechas en `src/lib/format.ts`

**Files:**
- Modify: `src/lib/format.ts`
- Test: `tests/format.test.ts`

- [ ] **Step 1: Test que falla**

`tests/format.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { formatDate, formatDateOnly, weekdayShort } from "@/lib/format";

describe("fechas", () => {
  it("formatDate muestra un timestamptz en la zona de la empresa (dd/mm/aaaa)", () => {
    expect(formatDate("2026-10-10T03:56:01+00:00", "America/Caracas")).toBe("09/10/2026");
    expect(formatDate("2026-10-10T03:56:01+00:00", "UTC")).toBe("10/10/2026");
    expect(formatDate(null, "UTC")).toBe("—");
  });
  it("formatDateOnly no pasa una columna DATE por new Date() (que la corría un día)", () => {
    expect(formatDateOnly("2026-10-01")).toBe("01/10/2026");
    expect(formatDateOnly(null)).toBe("—");
  });
  it("weekdayShort etiqueta un día local", () => {
    expect(weekdayShort("2026-10-09")).toBe("vie");
    expect(weekdayShort("2026-10-10")).toBe("sáb");
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/format.test.ts`
Expected: FAIL — `formatDate is not a function`.

- [ ] **Step 3: Añadir a `src/lib/format.ts`** (debajo de `formatMoney`)

```ts
import { isDateISO } from "@/lib/tz";

// Zona de respaldo local a este módulo (no importar tenant.ts aquí: arrastraría código de servidor
// a cualquier cliente que importe formatMoney).
const FALLBACK_TZ = "America/Caracas";

function dateFormatter(tz: string): Intl.DateTimeFormat {
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
  try { return new Intl.DateTimeFormat("es-VE", { ...opts, timeZone: tz || FALLBACK_TZ }); }
  catch { return new Intl.DateTimeFormat("es-VE", { ...opts, timeZone: FALLBACK_TZ }); }
}

/** Timestamp (ISO con zona) → "dd/mm/aaaa" en la zona de la empresa. Nunca lanza.
 *  Si por error recibe una columna DATE ("YYYY-MM-DD"), la muestra tal cual sin correrla un día. */
export function formatDate(iso: string | null | undefined, tz: string): string {
  if (!iso) return "—";
  if (isDateISO(iso)) return formatDateOnly(iso);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return dateFormatter(tz).format(d);
}

/** Columna DATE ("YYYY-MM-DD") → "dd/mm/aaaa" sin interpretar zona (new Date("2026-10-01") daría 30/09 en Venezuela).
 *  Rechaza instantes completos y fechas inválidas con "—" en vez de inventar un día. */
export function formatDateOnly(dateISO: string | null | undefined): string {
  if (!isDateISO(dateISO)) return "—";
  const [y, m, d] = dateISO.split("-");
  return `${d}/${m}/${y}`;
}

/** "YYYY-MM-DD" → "lun" … "dom" (minúsculas, como lo devuelve es-VE). "—" si la fecha no es válida. */
export function weekdayShort(dateISO: string | null | undefined): string {
  if (!isDateISO(dateISO)) return "—";
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", weekday: "short" }).format(new Date(Date.UTC(y, m - 1, d)));
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/format.test.ts`
Expected: PASS (3 tests). Si `weekdayShort` devuelve `"vie."` con punto, ajustar el test a lo que da Node (`console.log` una vez) — la forma exacta depende de ICU; lo que importa es que sea el día correcto.
(Más casos —borde de medianoche, DATE por error, zona inválida, degradación— se añadieron en la revisión; ver tests/format.test.ts.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts tests/format.test.ts
git commit -m "feat(format): formatDate en zona de la empresa, formatDateOnly para columnas DATE, weekdayShort"
```

---

### Task 5: Consultas que filtran por fecha reciben `tz`

**Files:**
- Modify: `src/lib/reportes/queries.ts` (firma de `salesReport`, `byDay`, wrappers)
- Modify: `src/lib/ventas/queries.ts` (`salesKpi`, quitar `monthStartISO`)
- Modify: `src/lib/clientes/queries.ts:52-61` (`clientsKpi`)
- Modify: `src/lib/cobros/queries.ts` (`todayISO` → parámetro `today`)
- Test: `tests/reportes.test.ts` (añadir bloque), `tests/cobros.test.ts` (ajustar llamadas), `tests/ventas.test.ts` y `tests/clientes.test.ts` (pasar `tz` a `salesKpi`/`clientsKpi`: `tsconfig` también typechequea `tests/`)

- [ ] **Step 1: Test que falla (añadir al final de `tests/reportes.test.ts`)**

```ts
import { admin } from "./setup";

describe("reportes — zona horaria de la empresa", () => {
  it("una venta de las 23:56 (VE) cuenta en el día local 9/10, no en el 10/10", async () => {
    const a = await makeTenant("tzrep"); const b = await mainBranch(a); const p = await makeProduct(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, [
      { productId: p, description: "Café", quantity: 1, unitPrice: 10, discountPct: 0, taxRate: 0 },
    ]));
    await emitSale(a.client, id, { paymentType: "contado", paymentMethod: "efectivo" });
    // Forzar el instante: 10/10 03:56Z = 9/10 23:56 en Caracas. (El owner puede editar sus ventas por RLS.)
    const { error } = await a.client.from("sales").update({ issued_at: "2026-10-10T03:56:01Z" }).eq("id", id);
    expect(error).toBeNull();

    const VE = "America/Caracas";
    const dia9 = await salesReport(a.client, { from: "2026-10-09", to: "2026-10-09", tz: VE });
    const dia10 = await salesReport(a.client, { from: "2026-10-10", to: "2026-10-10", tz: VE });
    expect(dia9.summary.count).toBe(1);
    expect(dia9.byDay).toEqual([{ date: "2026-10-09", revenue: 10, utility: 6 }]);
    expect(dia10.summary.count).toBe(0);

    const utc10 = await salesReport(a.client, { from: "2026-10-10", to: "2026-10-10", tz: "UTC" });
    expect(utc10.summary.count).toBe(1);
  });
});
```
Y actualizar la constante `WIDE` del archivo a `const WIDE = { from: "2000-01-01", to: "2100-01-01", tz: "UTC" };` (las llamadas existentes `salesReport(a.client, WIDE)` siguen válidas).

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/reportes.test.ts`
Expected: FAIL en el bloque nuevo (`dia9.summary.count` es 0 porque hoy el rango se compara en UTC).

- [ ] **Step 3: `salesReport` con `tz`** — en `src/lib/reportes/queries.ts`

Cambiar imports y la función:
```ts
import { monthRange, weekRange, type DateRange } from "@/lib/reportes/ranges";
import { rangeToInstants, localDateISO } from "@/lib/tz";

export type ReportOpts = DateRange & { branchId?: string | null; tz: string };

export async function salesReport(sb: SupabaseClient, opts: ReportOpts): Promise<SalesReport> {
  try {
    const { from, to, branchId = null, tz } = opts;
    const { fromInstant, toInstant } = rangeToInstants({ from, to }, tz);
    let sq = sb.from("sales").select("id, created_by, client_id, total, tax_total, issued_at, clients(name)")
      .eq("status", "issued").gte("issued_at", fromInstant).lt("issued_at", toInstant);
```
y dentro del bucle `for (const s of sales as any[])` reemplazar
`const date = String(s.issued_at).slice(0, 10);` por
`const date = localDateISO(new Date(s.issued_at), tz);`.
Quitar el import de `addDays` (ya no se usa aquí).

Wrappers al final del archivo:
```ts
export async function utilityThisMonth(sb: SupabaseClient, tz: string): Promise<{ utility: number; costIncompleteCount: number }> {
  const r = await salesReport(sb, { ...monthRange(new Date(), tz), tz });
  return { utility: r.summary.utility, costIncompleteCount: r.summary.costIncompleteCount };
}
export async function salesByDayThisWeek(sb: SupabaseClient, tz: string): Promise<{ date: string; revenue: number; utility: number }[]> {
  return (await salesReport(sb, { ...weekRange(new Date(), tz), tz })).byDay;
}
export async function topProductsThisMonth(sb: SupabaseClient, tz: string, limit = 5): Promise<{ productId: string | null; name: string; qty: number; revenue: number }[]> {
  return (await salesReport(sb, { ...monthRange(new Date(), tz), tz })).byProduct.slice(0, limit);
}
```

- [ ] **Step 4: `salesKpi` con `tz`** — en `src/lib/ventas/queries.ts`

Borrar `function monthStartISO()` (línea 15) y reemplazar `salesKpi`:
```ts
import { monthRange } from "@/lib/reportes/ranges";
import { rangeToInstants } from "@/lib/tz";

export async function salesKpi(sb: SupabaseClient, tz: string): Promise<{ monthTotal: number; avgTicket: number }> {
  try {
    const { fromInstant, toInstant } = rangeToInstants(monthRange(new Date(), tz), tz);
    const { data, error } = await sb.from("sales").select("total").eq("status", "issued")
      .gte("issued_at", fromInstant).lt("issued_at", toInstant);
    if (error || !data) return { monthTotal: 0, avgTicket: 0 };
    const monthTotal = data.reduce((s: number, r: any) => s + Number(r.total), 0);
    return { monthTotal: round2(monthTotal), avgTicket: data.length ? round2(monthTotal / data.length) : 0 };
  } catch { return { monthTotal: 0, avgTicket: 0 }; }
}
```

- [ ] **Step 5: `clientsKpi` con `tz`** — en `src/lib/clientes/queries.ts`

```ts
import { monthRange } from "@/lib/reportes/ranges";
import { rangeToInstants } from "@/lib/tz";

export async function clientsKpi(sb: SupabaseClient, tz: string): Promise<{ total: number; newThisMonth: number }> {
  try {
    const { fromInstant } = rangeToInstants(monthRange(new Date(), tz), tz);
    const total = await sb.from("clients").select("id", { count: "exact", head: true }).eq("active", true);
    const fresh = await sb.from("clients").select("id", { count: "exact", head: true })
      .eq("active", true).gte("created_at", fromInstant);
    if (total.error || fresh.error) return { total: 0, newThisMonth: 0 };
    return { total: total.count ?? 0, newThisMonth: fresh.count ?? 0 };
  } catch { return { total: 0, newThisMonth: 0 }; }
}
```

- [ ] **Step 6: cobros con `today` explícito** — en `src/lib/cobros/queries.ts`

Borrar `function todayISO()` (línea 6). Cambiar las tres firmas y usos:
```ts
export async function listReceivablesByClient(sb: SupabaseClient, opts: {
  search?: string; filter?: "todos" | "vencidos"; today: string;
}): Promise<ReceivableClientRow[]> {
  try {
    const { search = "", filter = "todos", today } = opts;
    // … (resto igual; eliminar la línea `const today = todayISO();`)
```
```ts
export async function getClientReceivable(sb: SupabaseClient, { clientId, today }: { clientId: string; today: string }): Promise<{ … }> {
  // … eliminar `const today = todayISO();` (objeto de opciones: dos strings adyacentes se confunden)
```
```ts
export async function receivablesKpi(sb: SupabaseClient, today: string): Promise<{ total: number; overdue: number }> {
  // … eliminar `const today = todayISO();`
```
`today` es un "YYYY-MM-DD" en la zona de la empresa (lo producirá `todayISO(tz)` de `@/lib/tz` en las páginas).

- [ ] **Step 7: Ajustar `tests/cobros.test.ts`**

Buscar las llamadas a `listReceivablesByClient(`, `getClientReceivable(` y `receivablesKpi(` y pasarles `today`: para la lista `{ ...opts, today: "2100-01-01" }` donde el test espera que algo esté vencido con `due_date` en el pasado, o `today: new Date().toISOString().slice(0, 10)` donde replicaba el comportamiento anterior. Ejemplo: `listReceivablesByClient(a.client, { today: HOY })` con `const HOY = new Date().toISOString().slice(0, 10);` definido arriba del archivo.

- [ ] **Step 8: Correr todo y typecheck**

Run: `npx vitest run tests/reportes.test.ts tests/cobros.test.ts`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: errores SOLO en páginas/componentes que llaman a estas funciones (se arreglan en Task 6). Anotar la lista.

- [ ] **Step 9: Commit**

```bash
git add src/lib/reportes/queries.ts src/lib/ventas/queries.ts src/lib/clientes/queries.ts src/lib/cobros/queries.ts tests/reportes.test.ts tests/cobros.test.ts tests/ventas.test.ts tests/clientes.test.ts
git commit -m "feat(consultas): rangos y 'hoy' en la zona horaria de la empresa (ventas, reportes, clientes, cobros)"
```

---

### Task 6: Páginas y componentes usan la zona de la empresa (y columnas DATE sin corrimiento)

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/reportes/ventas/page.tsx`, `src/components/reportes/period-selector.tsx`
- Modify: `src/app/(app)/finanzas/cuentas-por-cobrar/page.tsx`, `src/app/(app)/finanzas/cuentas-por-cobrar/[clientId]/page.tsx`
- Modify: `src/components/cobros/payment-form.tsx`, `src/components/cobros/payments-history.tsx`, `src/components/cobros/due-date-field.tsx`, `src/components/cobros/receivables-table.tsx`
- Modify: `src/app/(app)/operaciones/facturacion/page.tsx`, `src/components/ventas/sales-table.tsx`, `src/components/ventas/sale-row-card.tsx`
- Modify: `src/app/(app)/operaciones/facturacion/[id]/page.tsx`
- Modify: `src/app/(app)/clientes/[id]/page.tsx`
- Modify: `src/components/inventario/movements-history.tsx`, `src/components/inventario/product-stock-panel.tsx`
- Modify: `src/app/(app)/operaciones/presupuestos/page.tsx`, `src/components/presupuestos/quotes-table.tsx`, `src/components/presupuestos/quote-document.tsx`

- [ ] **Step 1: Dashboard**

En `src/app/(app)/dashboard/page.tsx`:
```ts
import { getTenantSettings } from "@/lib/tenant";
import { weekdayShort } from "@/lib/format";
// …
  const { currency, timezone: tz } = await getTenantSettings(supabase);
  const [kpi, byType, prodKpi, byCategory, sKpi, recv] = await Promise.all([
    clientsKpi(supabase, tz), clientsByType(supabase), productsKpi(supabase), productsByCategory(supabase),
    salesKpi(supabase, tz), receivablesTotal(supabase),
  ]);
  const [invKpi, invBreakdown] = await Promise.all([stockKpi(supabase), inventoryStatusBreakdown(supabase)]);
  const [util, weekDays, topProds] = await Promise.all([
    utilityThisMonth(supabase, tz), salesByDayThisWeek(supabase, tz), topProductsThisMonth(supabase, tz, 5),
  ]);
  // …
  const weekBars = weekDays.map((d) => ({ label: weekdayShort(d.date), value: d.revenue }));
```
Quitar `getTenantCurrency` del import de productos (ya no se usa aquí).

- [ ] **Step 2: Reporte de ventas**

`src/app/(app)/reportes/ventas/page.tsx`:
```ts
import { getTenantSettings } from "@/lib/tenant";
import { isDateISO, todayISO } from "@/lib/tz";
import { formatDateOnly } from "@/lib/format";
// …
  const { currency, timezone: tz } = await getTenantSettings(sb);
  const def = monthRange(new Date(), tz);
  // Si cualquiera de los dos extremos no sirve, manda el preset completo: nunca un rango mezclado.
  const valid = isDateISO(sp.from) && isDateISO(sp.to);
  const { from, to } = valid ? { from: sp.from as string, to: sp.to as string } : def;
  // …
  const [report, { data: branches }] = await Promise.all([
    salesReport(sb, { from, to, branchId: sp.branch || null, tz }),
    sb.from("branches").select("id, name").order("is_main", { ascending: false }),
  ]);
  const dayBars = report.byDay.map((d) => ({ label: formatDateOnly(d.date).slice(0, 5), value: d.revenue }));
  // …
  <PeriodSelector branches={(branches ?? []) as any} showBranch={isBackOffice} today={todayISO(tz)} from={from} to={to} />
```
En `src/lib/reportes/ranges.ts` añadir una entrada por día ya calculado y que la anterior delegue, para que el selector sea determinista (sin `new Date()` en el cliente): `presetRangeFor(preset, today)`, `PRESET_KEYS` y `activePreset(today, range)` (el preset más estrecho gana en empates: hoy > semana > mes). `presetRange(preset, ref, tz)` queda como `presetRangeFor(preset, localDateISO(ref, tz))`.

`src/components/reportes/period-selector.tsx`: añadir props `today`, `from`, `to` (la página pasa `today={todayISO(tz)}`); usar `presetRangeFor(p, today)` y `activePreset`; los `<input type="date">` muestran `defaultValue={from}` / `defaultValue={to}` (así el preset por defecto se ve); y marcar el preset activo:
```tsx
export function PeriodSelector({ branches, showBranch, today, from, to }: {
  branches: { id: string; name: string }[]; showBranch: boolean; today: string; from: string; to: string;
}) {
  // …
  function setPreset(p: Preset) {
    const r = presetRangeFor(p, today);
    // … igual
  }
  const active = activePreset(today, { from, to });
  // en el map de PRESETS:
  <button key={p.key} onClick={() => setPreset(p.key)} aria-pressed={active === p.key}
    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${active === p.key
      ? "border-[#0e7490] bg-[#0e7490] text-white"
      : "border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg)]"}`}>
  // inputs:
  <input type="date" className={dateCls} key={`from-${from}`} defaultValue={from} onChange={(e) => setDate("from", e.target.value)} />
  <input type="date" className={dateCls} key={`to-${to}`} defaultValue={to} onChange={(e) => setDate("to", e.target.value)} />
```

- [ ] **Step 3: Cuentas por cobrar (lista y cliente)**

`src/app/(app)/finanzas/cuentas-por-cobrar/page.tsx`:
```ts
import { getTenantSettings } from "@/lib/tenant";
import { todayISO } from "@/lib/tz";
// …
  const { currency, timezone: tz } = await getTenantSettings(sb);
  const rows = await listReceivablesByClient(sb, { search: sp.q ?? "", filter, today: todayISO(tz) });
```
(y quitar `getTenantCurrency` del import).

`src/app/(app)/finanzas/cuentas-por-cobrar/[clientId]/page.tsx`: igual, `getClientReceivable(sb, clientId, todayISO(tz))`; donde muestra `Vence ${new Date(s.dueDate).toLocaleDateString("es-VE")}` usar `Vence ${formatDateOnly(s.dueDate)}`; pasar `today={todayISO(tz)}` a `<PaymentForm … />`.

`src/components/cobros/receivables-table.tsx`: `{formatDateOnly(r.oldestDueDate)}` en lugar de `new Date(...).toLocaleDateString`.

- [ ] **Step 4: Formulario de abono, historial y vencimiento**

`src/components/cobros/payment-form.tsx`: nueva prop `today: string`; borrar `const today = new Date().toISOString().slice(0, 10);` y usar la prop en `defaultValue={today} max={today}`.

`src/components/cobros/payments-history.tsx`: `paid_at` es DATE → `{formatDateOnly(p.paidAt)}` (import de `@/lib/format`).

`src/components/cobros/due-date-field.tsx`: `{formatDateOnly(dueDate)}` en la rama de solo lectura.

- [ ] **Step 5: Lista y detalle de ventas, ficha de cliente**

`src/app/(app)/operaciones/facturacion/page.tsx`: obtener `const { timezone: tz } = await getTenantSettings(sb);` y pasar `tz` a `<SalesTable rows={list.rows} tz={tz} />` y `<SaleRowCard key={r.id} r={r} tz={tz} />`.

`src/components/ventas/sales-table.tsx`: prop `tz: string`; la celda Fecha → `{formatDate(r.issuedAt ?? r.createdAt, tz)}`.
`src/components/ventas/sale-row-card.tsx`: prop `tz: string` (aún no muestra fecha; la prop queda lista para Task 7).

`src/app/(app)/operaciones/facturacion/[id]/page.tsx`: reemplazar `getTenantCurrency(sb)` por `getTenantSettings(sb)` y pasar `today={todayISO(tz)}` a `<PaymentForm …/>`:
```ts
  const [payments, settings] = await Promise.all([
    issued ? listPayments(sb, id) : Promise.resolve([]),
    getTenantSettings(sb),
  ]);
  const { currency, timezone: tz } = settings;
```

`src/app/(app)/clientes/[id]/page.tsx`: `const [history, settings] = await Promise.all([salesByClient(sb, c.id), getTenantSettings(sb)]); const { currency, timezone: tz } = settings;` y en el historial `{formatDate(s.issuedAt, tz)}`.

- [ ] **Step 6: Movimientos de inventario**

`src/components/inventario/movements-history.tsx`: prop `tz: string`; `{formatDate(m.createdAt, tz)}`.
`src/components/inventario/product-stock-panel.tsx`: prop `tz: string` (no consulta ajustes por su cuenta) y pasarlo a `<MovementsHistory movements={movements} tz={tz} />`. En `src/app/(app)/operaciones/productos/[id]/page.tsx` cambiar `getTenantCurrency(sb)` por `getTenantSettings(sb)` y pasar `tz` al panel.

- [ ] **Step 7: Presupuestos**

`src/app/(app)/operaciones/presupuestos/page.tsx`: `const { timezone: tz } = await getTenantSettings(sb);` y `<QuotesTable rows={list.rows} tz={tz} today={todayISO(tz)} />`.
`src/components/presupuestos/quotes-table.tsx`:
```tsx
function isOverdue(r: QuoteListRow, today: string): boolean {
  return !!r.validUntil && r.validUntil < today && ["sent", "accepted"].includes(r.status);
}
export function QuotesTable({ rows, tz, today }: { rows: QuoteListRow[]; tz: string; today: string }) {
  // Fecha: {formatDate(r.createdAt, tz)}
  // Vigencia: {formatDateOnly(r.validUntil)}{isOverdue(r, today) ? " · vencido" : ""}
```
`src/components/presupuestos/quote-document.tsx`: prop `today: string` para el cálculo de `overdue` (el mismo día de la empresa que usa la lista) y `Válido hasta: {formatDateOnly(quote.valid_until)}`. En `src/app/(app)/operaciones/presupuestos/[id]/page.tsx`: `const { timezone: tz } = await getTenantSettings(sb);` y `<QuoteDocument quote={quote as any} today={todayISO(tz)} />`.

- [ ] **Step 8: Typecheck + tests + arranque**

Run: `npx tsc --noEmit` → Expected: sin errores.
Run: `npx vitest run` → Expected: todo PASS.
Run: `npm run build` → Expected: build limpio.

- [ ] **Step 9: Commit**

```bash
git add -A src/app src/components
git commit -m "feat(ui): fechas y períodos en la zona horaria de la empresa; columnas DATE sin corrimiento"
```

---

### Task 6b: El lado de escritura también usa el día de la empresa (fecha de cobro)

> Añadida tras la revisión de la Task 5: las lecturas ya respetan la zona, pero `paid_at` se guardaba con el día UTC y la regla «la fecha no puede ser futura» se evaluaba contra el día UTC. En Caracas, un cobro al contado después de las 20:00 quedaba fechado mañana.

**Files:**
- Modify: `src/lib/ventas/mutations.ts` (`emitSale`)
- Modify: `src/lib/cobros/mutations.ts` (`registerPayment`), `src/lib/cobros/schema.ts` (quitar la validación «futura» del schema)
- Modify: `src/app/(app)/operaciones/facturacion/actions.ts:71`, `src/app/(app)/finanzas/cuentas-por-cobrar/actions.ts:44-50`
- Test: `tests/cobros.test.ts`

- [ ] **Step 1: Test que falla (añadir a `tests/cobros.test.ts`)**

```ts
describe("cobros — la fecha del cobro es el día de la empresa", () => {
  it("contado: paid_at = today recibido (no el día UTC del servidor)", async () => {
    const a = await makeTenant("payday"); const b = await mainBranch(a); const p = await makeProduct(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, [
      { productId: p, description: "Café", quantity: 1, unitPrice: 10, discountPct: 0, taxRate: 0 },
    ]));
    await emitSale(a.client, id, { paymentType: "contado", paymentMethod: "efectivo" }, "2026-10-09");
    const { data } = await a.client.from("payments").select("paid_at").eq("sale_id", id).single();
    expect(data!.paid_at).toBe("2026-10-09");
  });
  it("abono: sin paidAt usa today; con paidAt futuro respecto a today lanza", async () => {
    const a = await makeTenant("payday2"); const b = await mainBranch(a); const p = await makeProduct(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, [
      { productId: p, description: "Café", quantity: 1, unitPrice: 100, discountPct: 0, taxRate: 0 },
    ]));
    await emitSale(a.client, id, { paymentType: "credito" }, "2026-10-09");
    const pid = await registerPayment(a.client, a.tenantId, a.id, { saleId: id, amount: 10 }, "2026-10-09");
    const { data } = await a.client.from("payments").select("paid_at").eq("id", pid).single();
    expect(data!.paid_at).toBe("2026-10-09");
    await expect(registerPayment(a.client, a.tenantId, a.id, { saleId: id, amount: 10, paidAt: "2026-10-10" }, "2026-10-09"))
      .rejects.toThrow(/futura/);
    await expect(registerPayment(a.client, a.tenantId, a.id, { saleId: id, amount: 10 }, "basura"))
      .rejects.toThrow(/today/);
  });
});
```
(Usar los helpers `makeTenant`/`mainBranch`/`makeProduct`/`saleOf` que ya existen en ese archivo o copiarlos de `tests/reportes.test.ts`.)

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/cobros.test.ts`
Expected: FAIL — `emitSale` ignora el cuarto argumento (paid_at = día UTC de hoy) y `registerPayment` no acepta `today`.

- [ ] **Step 3: `emitSale` recibe `today`** — en `src/lib/ventas/mutations.ts`

```ts
import { todayISO, isDateISO, DEFAULT_TZ } from "@/lib/tz";

/** `today` = "YYYY-MM-DD" en la zona de la empresa (fecha del cobro al contado). */
export async function emitSale(sb: SupabaseClient, id: string, payment: EmitInput, today: string = todayISO(DEFAULT_TZ)): Promise<void> {
  if (!isDateISO(today)) throw new Error(`"today" inválido: ${today}`);
  // … igual …
  // en el insert del contado:
      method: payment.paymentMethod ?? null, paid_at: today,
```

- [ ] **Step 4: `registerPayment` recibe `today` y valida «no futura» ahí** — en `src/lib/cobros/mutations.ts`

```ts
import { isDateISO } from "@/lib/tz";

export async function registerPayment(
  sb: SupabaseClient, tenantId: string, userId: string, input: PaymentInput, today: string,
): Promise<string> {
  if (!isDateISO(today)) throw new Error(`"today" inválido: ${today}`);
  if (input.paidAt && input.paidAt > today) throw new Error("La fecha no puede ser futura");
  // … igual …
    paid_at: input.paidAt ?? today,
```
En `src/lib/cobros/schema.ts` borrar `const todayISO = …` y dejar `paidAt: optDate,` (sin `.refine`): la regla vive en la mutación y en la acción, donde se conoce la zona.

- [ ] **Step 5: Las acciones pasan `today` de la empresa**

`src/app/(app)/operaciones/facturacion/actions.ts` (dentro de `submitSaleAction`, donde ya obtiene `currency`):
```ts
import { getTenantSettings } from "@/lib/tenant";
import { todayISO } from "@/lib/tz";
// …
    const { currency, timezone } = await getTenantSettings(sb);
    // …
      await m.emitSale(sb, saleId, pay.data, todayISO(timezone));
```
(y quitar `getTenantCurrency` si queda sin uso en ese archivo).

`src/app/(app)/finanzas/cuentas-por-cobrar/actions.ts` (`registerPaymentAction`):
```ts
import { getTenantSettings } from "@/lib/tenant";
import { todayISO } from "@/lib/tz";
// …
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
  const today = todayISO((await getTenantSettings(sb)).timezone);
  if (parsed.data.paidAt && parsed.data.paidAt > today) return { ok: false, fieldErrors: { paidAt: "La fecha no puede ser futura" } };
  try { await m.registerPayment(sb, tenantId, userId, parsed.data, today); }
```

- [ ] **Step 6: Tests existentes** — en `tests/cobros.test.ts` toda llamada a `registerPayment(` existente pasa `HOY` como quinto argumento. Las llamadas a `emitSale(` sin cuarto argumento siguen válidas (default).

- [ ] **Step 7: Verificar**

Run: `npx vitest run tests/cobros.test.ts tests/ventas.test.ts tests/reportes.test.ts` → PASS. `npx vitest run` → PASS. `npx tsc --noEmit` → sin errores nuevos.

- [ ] **Step 8: Commit**

```bash
git add src/lib/ventas/mutations.ts src/lib/cobros/mutations.ts src/lib/cobros/schema.ts "src/app/(app)/operaciones/facturacion/actions.ts" "src/app/(app)/finanzas/cuentas-por-cobrar/actions.ts" tests/cobros.test.ts
git commit -m "fix(cobros): la fecha del cobro y la regla 'no futura' usan el día de la empresa"
```

---

### Task 7: Estado de pago (Pagada / Parcial / Pendiente / Vencida) en lista, detalle y badge

**Files:**
- Create: `src/lib/cobros/status.ts`
- Modify: `src/lib/ventas/queries.ts` (`SaleListRow`, `listSales`, `SalePaymentFilter`)
- Modify: `src/components/ventas/status-badge.tsx`, `src/components/ventas/sales-table.tsx`, `src/components/ventas/sale-row-card.tsx`, `src/components/ventas/sales-toolbar.tsx`, `src/components/ventas/sale-document.tsx`
- Modify: `src/app/(app)/operaciones/facturacion/page.tsx`, `src/app/(app)/operaciones/facturacion/[id]/page.tsx`
- Test: `tests/payment-status.test.ts`, `src/components/ventas/status-badge.test.tsx`

- [ ] **Step 1: Test de la función pura (falla)**

`tests/payment-status.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { paymentStatusOf } from "@/lib/cobros/status";

const HOY = "2026-10-09";
describe("paymentStatusOf", () => {
  it("borrador y anulada no tienen estado de pago", () => {
    expect(paymentStatusOf({ status: "draft", total: 10, paidAmount: 0, dueDate: null }, HOY)).toBeNull();
    expect(paymentStatusOf({ status: "void", total: 10, paidAmount: 0, dueDate: null }, HOY)).toBeNull();
  });
  it("pagada cuando el saldo es cero (o negativo por redondeo)", () => {
    expect(paymentStatusOf({ status: "issued", total: 25.4, paidAmount: 25.4, dueDate: null }, HOY)).toBe("pagada");
    expect(paymentStatusOf({ status: "issued", total: 10, paidAmount: 10.004, dueDate: "2026-01-01" }, HOY)).toBe("pagada");
  });
  it("parcial cuando hay abonos pero queda saldo", () => {
    expect(paymentStatusOf({ status: "issued", total: 10, paidAmount: 4, dueDate: null }, HOY)).toBe("parcial");
  });
  it("vencida gana a parcial/pendiente si due_date < hoy y hay saldo", () => {
    expect(paymentStatusOf({ status: "issued", total: 10, paidAmount: 4, dueDate: "2026-10-01" }, HOY)).toBe("vencida");
    expect(paymentStatusOf({ status: "issued", total: 10, paidAmount: 0, dueDate: "2026-10-08" }, HOY)).toBe("vencida");
    expect(paymentStatusOf({ status: "issued", total: 10, paidAmount: 0, dueDate: "2026-10-09" }, HOY)).toBe("pendiente"); // vence hoy: aún no
  });
  it("pendiente sin abonos y sin vencer", () => {
    expect(paymentStatusOf({ status: "issued", total: 10, paidAmount: 0, dueDate: null }, HOY)).toBe("pendiente");
    expect(paymentStatusOf({ status: "issued", total: 10, paidAmount: 0, dueDate: "2026-11-15" }, HOY)).toBe("pendiente");
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/payment-status.test.ts` → FAIL `Cannot find module '@/lib/cobros/status'`.

- [ ] **Step 3: Implementar `src/lib/cobros/status.ts`**

```ts
import { round2 } from "@/lib/ventas/totals";

export type PaymentStatus = "pagada" | "parcial" | "pendiente" | "vencida";
export type SaleLike = { status: string; total: number; paidAmount: number; dueDate: string | null };

/** Estado de pago derivado de una venta. `today` = "YYYY-MM-DD" en la zona de la empresa. Solo ventas emitidas. */
export function paymentStatusOf(s: SaleLike, today: string): PaymentStatus | null {
  if (!isDateISO(today)) throw new Error(`Fecha local inválida: ${today}`); // isDateISO de @/lib/tz
  if (s.status !== "issued") return null;
  const balance = round2(Number(s.total) - Number(s.paidAmount));
  if (balance <= 0) return "pagada";
  if (s.dueDate && s.dueDate < today) return "vencida";
  return Number(s.paidAmount) > 0 ? "parcial" : "pendiente";
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pagada: "Pagada", parcial: "Parcial", pendiente: "Pendiente", vencida: "Vencida",
};
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/payment-status.test.ts` → PASS (5 tests).

- [ ] **Step 5: `listSales` devuelve `dueDate` y `paymentStatus`; filtro «vencidas»**

En `src/lib/ventas/queries.ts`:
```ts
import { paymentStatusOf, type PaymentStatus } from "@/lib/cobros/status";

export type SalePaymentFilter = "pendientes" | "vencidas" | "todas";
export type SaleListRow = {
  id: string; number: number | null; status: "draft" | "issued" | "void";
  clientName: string | null; branchName: string | null;
  total: number; balance: number; currency: string; issuedAt: string | null; createdAt: string;
  dueDate: string | null; paymentStatus: PaymentStatus | null;
};

export async function listSales(sb: SupabaseClient, opts: {
  search?: string; status?: SaleStatusFilter; payment?: SalePaymentFilter; page?: number; pageSize?: number; today: string;
}): Promise<{ rows: SaleListRow[]; total: number; page: number; pageSize: number }> {
  const { search = "", status = "todas", payment = "todas", page = 1, pageSize = 20, today } = opts;
  let q = sb.from("sales").select(
    "id, number, status, total, paid_amount, currency, issued_at, created_at, due_date, clients(name), branches(name)",
    { count: "exact" },
  );
  if (STATUS_MAP[status]) q = q.eq("status", STATUS_MAP[status]);
  if (payment === "pendientes") q = q.eq("status", "issued").gt("balance", 0);
  if (payment === "vencidas") q = q.eq("status", "issued").gt("balance", 0).lt("due_date", today);
  // … búsqueda y paginación iguales …
  const rows: SaleListRow[] = (data ?? []).map((r: any) => ({
    id: r.id, number: r.number, status: r.status,
    clientName: r.clients?.name ?? null, branchName: r.branches?.name ?? null,
    total: Number(r.total), balance: round2(Number(r.total) - Number(r.paid_amount)),
    currency: r.currency, issuedAt: r.issued_at, createdAt: r.created_at,
    dueDate: r.due_date ?? null,
    paymentStatus: paymentStatusOf({ status: r.status, total: Number(r.total), paidAmount: Number(r.paid_amount), dueDate: r.due_date ?? null }, today),
  }));
```
En `tests/ventas.test.ts` las llamadas a `listSales(` reciben `today`: añadir `const HOY = new Date().toISOString().slice(0, 10);` arriba y `{ ...opts, today: HOY }` (o `{ today: HOY }` si no había opts).

- [ ] **Step 6: Badge con icono (test jsdom que falla)**

`src/components/ventas/status-badge.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SaleStatusBadge } from "./status-badge";

describe("SaleStatusBadge", () => {
  it("emitida sin estado de pago muestra Emitida", () => {
    render(<SaleStatusBadge status="issued" />);
    expect(screen.getByText("Emitida")).toBeTruthy();
  });
  it("emitida con estado de pago muestra el estado de pago", () => {
    render(<SaleStatusBadge status="issued" paymentStatus="vencida" />);
    expect(screen.getByText("Vencida")).toBeTruthy();
    expect(screen.queryByText("Emitida")).toBeNull();
  });
  it("borrador y anulada ignoran paymentStatus", () => {
    render(<SaleStatusBadge status="void" paymentStatus="pagada" />);
    expect(screen.getByText("Anulada")).toBeTruthy();
  });
  it("lleva icono (no depende solo del color)", () => {
    const { container } = render(<SaleStatusBadge status="issued" paymentStatus="pagada" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
```
Run: `npx vitest run src/components/ventas/status-badge.test.tsx` → FAIL (la prop `paymentStatus` no existe: muestra "Emitida").

- [ ] **Step 7: Reescribir `src/components/ventas/status-badge.tsx`**

```tsx
import type { LucideIcon } from "lucide-react";
import { Pencil, Check, CircleCheck, CircleDot, Clock, TriangleAlert, X } from "lucide-react";
import type { PaymentStatus } from "@/lib/cobros/status";

type Spec = { label: string; cls: string; icon: LucideIcon };
// Contraste AA a 12px: en light los tonos oscuros, en dark los claros.
const GRAY = "bg-[var(--bg)] text-[#475569] dark:text-[var(--text-soft)]";
const TEAL = "bg-[#0e7490]/10 text-[#0e7490] dark:text-[#5eead4]";
const GREEN = "bg-[#0f766e]/10 text-[#0f766e] dark:text-[#6ee7b7]";
const AMBER = "bg-[#b45309]/10 text-[#92400e] dark:text-[#fbbf24]";
const RED = "bg-[#dc2626]/10 text-[#b91c1c] dark:text-[#f87171]";
export const DANGER_TEXT = "font-medium text-[#b91c1c] dark:text-[#f87171]"; // saldo vencido fuera del chip

const DOC: Record<string, Spec> = {
  draft:  { label: "Borrador", cls: GRAY, icon: Pencil },
  issued: { label: "Emitida",  cls: TEAL, icon: Check },
  void:   { label: "Anulada",  cls: RED,  icon: X },
};
const PAY: Record<PaymentStatus, Spec> = { // etiquetas desde PAYMENT_LABEL (una sola fuente)
  pagada:    { label: PAYMENT_LABEL.pagada,    cls: GREEN, icon: CircleCheck },
  parcial:   { label: PAYMENT_LABEL.parcial,   cls: AMBER, icon: CircleDot },
  pendiente: { label: PAYMENT_LABEL.pendiente, cls: AMBER, icon: Clock },
  vencida:   { label: PAYMENT_LABEL.vencida,   cls: RED,   icon: TriangleAlert },
};

/** Estado del documento; si está emitida y se conoce el estado de pago, muestra ese (es lo que importa al usuario). */
export function SaleStatusBadge({ status, paymentStatus }: { status: string; paymentStatus?: PaymentStatus | null }) {
  const s = (status === "issued" && paymentStatus) ? PAY[paymentStatus] : (DOC[status] ?? { label: status, cls: GRAY, icon: Check });
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      <Icon className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />{s.label}
    </span>
  );
}
```
Run: `npx vitest run src/components/ventas/status-badge.test.tsx` → PASS (4).

- [ ] **Step 8: Lista: saldo solo en emitidas, rojo solo si vencida; fecha; filtro Vencidas**

`src/components/ventas/sales-table.tsx` (celdas Saldo y Estado):
```tsx
<td className={r.paymentStatus === "vencida" ? DANGER_TEXT : "text-[var(--text-soft)]"}>
  {r.status === "issued" && r.paymentStatus !== "pagada" ? formatMoney(r.balance, r.currency) : "—"}
</td>
<td><SaleStatusBadge status={r.status} paymentStatus={r.paymentStatus} /></td>
```
`src/components/ventas/sale-row-card.tsx`:
```tsx
<p className="truncate text-xs text-[var(--text-soft)]">  {/* fecha al final: si se recorta, se pierde la fecha, no el saldo */}
  {formatMoney(r.total, r.currency)}
  {r.status === "issued" && r.balance > 0 ? ` · saldo ${formatMoney(r.balance, r.currency)}` : ""}
  {` · ${formatDate(r.issuedAt ?? r.createdAt, tz)}`}
</p>
// …
<SaleStatusBadge status={r.status} paymentStatus={r.paymentStatus} />
```
`src/components/ventas/sales-toolbar.tsx`: la opción `pendientes` se llama «Con saldo» (el valor no cambia) y debajo va `<option value="vencidas">Vencidas</option>`.
`src/app/(app)/operaciones/facturacion/page.tsx`: aceptar `vencidas` en la validación del filtro (`["pendientes", "vencidas", "todas"]`) y llamar `listSales(sb, { search: sp.q ?? "", status, payment, page, today: todayISO(tz) })`.

- [ ] **Step 9: Detalle: bloque «Pago» honesto y vencimiento solo con saldo**

`src/components/ventas/sale-document.tsx`: añadir al tipo `Sale` → `due_date?: string | null;` y nuevas props `paymentStatus?: PaymentStatus | null`. Reemplazar el bloque `{sale.status === "issued" && (…)}` por:
```tsx
// La frase se arma con los datos, no con el estado (una vencida parcial dice lo pagado y lo que falta).
const paid = Number(sale.paid_amount), total = Number(sale.total);
const balance = round2(total - paid);
const payParts = [
  paymentStatus === "pagada" && sale.payment_method ? sale.payment_method : null,
  paid > 0 && balance > 0 ? `pagado ${formatMoney(paid, c)} de ${formatMoney(total, c)}` : null,
  balance > 0 ? `saldo ${formatMoney(balance, c)}` : null,
  sale.due_date
    ? `${paymentStatus === "vencida" ? "venció el" : paymentStatus === "pagada" ? "vencía el" : "vence el"} ${formatDateOnly(sale.due_date)}`
    : null,
].filter(Boolean);

{sale.status === "issued" && (
  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[var(--text-soft)]">Pago</span>
      <span className="flex flex-wrap items-center justify-end gap-2 font-medium text-[var(--text)]">
        <SaleStatusBadge status="issued" paymentStatus={paymentStatus ?? null} />
        {payParts.length ? <span>· {payParts.join(" · ")}</span> : null}
      </span>
    </div>
  </div>
)}
```
(Se elimina la frase «Los abonos parciales llegan con el módulo de Cobros».) Imports: `formatDateOnly` de `@/lib/format`, `round2` de `@/lib/ventas/totals`, `PaymentStatus` de `@/lib/cobros/status`.

`src/app/(app)/operaciones/facturacion/[id]/page.tsx`:
```ts
import { paymentStatusOf } from "@/lib/cobros/status";
import { todayISO } from "@/lib/tz";
// …
  const today = todayISO(tz);
  const paymentStatus = paymentStatusOf({ status: sale.status, total: Number(sale.total), paidAmount: Number(sale.paid_amount), dueDate: sale.due_date ?? null }, today);
  // …
  <SaleDocument sale={sale as any} paymentStatus={paymentStatus} />
  // en la cabecera de Cobros: solo si queda saldo
  {balance > 0 && <DueDateField saleId={sale.id} dueDate={sale.due_date ?? null} canEdit={canEditDueDate(role)} />}
```

- [ ] **Step 10: Typecheck + tests**

Run: `npx tsc --noEmit` → sin errores. Run: `npx vitest run` → PASS.

- [ ] **Step 11: Commit**

```bash
git add -A src tests/payment-status.test.ts tests/ventas.test.ts
git commit -m "feat(ventas): estado de pago Pagada/Parcial/Pendiente/Vencida en lista, detalle y badge con icono"
```

---

### Task 8: Botones del builder con intención (no «Guardando…» y «Emitiendo…» a la vez)

**Files:**
- Create: `src/components/shared/use-submit-intent.ts`
- Modify: `src/components/ventas/sale-builder.tsx:112-145`, `src/components/presupuestos/quote-builder.tsx:113-120`
- Test: `src/components/shared/use-submit-intent.test.tsx`

- [ ] **Step 1: Test que falla**

`src/components/shared/use-submit-intent.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSubmitIntent } from "./use-submit-intent";

describe("useSubmitIntent", () => {
  it("solo el botón pulsado se ve como pendiente", () => {
    const { result, rerender } = renderHook(({ pending }) => useSubmitIntent<"save" | "emit">(pending), { initialProps: { pending: false } });
    act(() => result.current.mark("emit"));
    rerender({ pending: true });
    expect(result.current.isPending("emit")).toBe(true);
    expect(result.current.isPending("save")).toBe(false);
  });
  it("se limpia cuando termina la acción", () => {
    const { result, rerender } = renderHook(({ pending }) => useSubmitIntent<"save" | "emit">(pending), { initialProps: { pending: false } });
    act(() => result.current.mark("save"));
    rerender({ pending: true });
    rerender({ pending: false });
    expect(result.current.isPending("save")).toBe(false);
  });
});
```
Run: `npx vitest run src/components/shared/use-submit-intent.test.tsx` → FAIL (módulo inexistente).

- [ ] **Step 2: Implementar el hook**

`src/components/shared/use-submit-intent.ts`:
```ts
"use client";
import { useEffect, useState } from "react";

/** Para formularios con varios botones de submit y un solo `pending` (useActionState):
 *  marca qué botón se pulsó y expone `isPending(intent)` para que solo ese cambie de texto. */
export function useSubmitIntent<T extends string>(pending: boolean) {
  const [intent, setIntent] = useState<T | null>(null);
  useEffect(() => { if (!pending) setIntent(null); }, [pending]);
  return {
    mark: (i: T) => setIntent(i),
    isPending: (i: T) => pending && intent === i,
  };
}
```
Run el test → PASS (2).

- [ ] **Step 3: Aplicar en `sale-builder.tsx`**

```tsx
import { useSubmitIntent } from "@/components/shared/use-submit-intent";
// dentro del componente, tras useActionState:
const submit = useSubmitIntent<"save" | "emit">(pending);
```
Botones:
```tsx
<button name="intent" value="save" disabled={pending} onClick={() => submit.mark("save")} className="…igual…">
  {submit.isPending("save") ? "Guardando…" : "Guardar borrador"}
</button>
<button type="button" onClick={() => setEmitOpen((v) => !v)} disabled={lines.length === 0} className="…igual…">Emitir</button>
// …
<button name="intent" value="emit" disabled={pending} onClick={() => submit.mark("emit")} className="…igual…">
  {submit.isPending("emit") ? "Emitiendo…" : "Confirmar emisión"}
</button>
```

- [ ] **Step 4: Aplicar en `quote-builder.tsx`** (mismo patrón con `"save" | "send"`, textos «Guardando…» / «Enviando…»).

- [ ] **Step 5: Typecheck y commit**

Run: `npx tsc --noEmit` → sin errores.
```bash
git add src/components/shared/use-submit-intent.ts src/components/shared/use-submit-intent.test.tsx src/components/ventas/sale-builder.tsx src/components/presupuestos/quote-builder.tsx
git commit -m "fix(builders): solo el botón pulsado muestra estado pendiente"
```

---

### Task 9: Toasts de éxito (provider propio + flash por URL)

**Files:**
- Create: `src/components/ui/toast.tsx`, `src/components/ui/toast.test.tsx`
- Create: `src/lib/flash.ts`, `tests/flash.test.ts`
- Create: `src/components/shell/flash-toast.tsx`
- Modify: `src/components/shell/app-shell.tsx`
- Modify: acciones con redirect: `src/app/(app)/clientes/actions.ts`, `src/app/(app)/operaciones/productos/actions.ts`, `src/app/(app)/operaciones/facturacion/actions.ts`, `src/app/(app)/operaciones/presupuestos/actions.ts`
- Modify: formularios in-place: `src/components/cobros/payment-form.tsx`, `src/components/inventario/stock-adjust-form.tsx`, `src/components/cobros/due-date-field.tsx`

- [ ] **Step 1: Test del toast (falla)**

`src/components/ui/toast.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { ToastProvider, useToast } from "./toast";

afterEach(() => { cleanup(); vi.useRealTimers(); });

function Demo({ href }: { href?: string }) {
  const { toast } = useToast();
  return <button onClick={() => toast({ title: "Venta #4 emitida", href })}>go</button>;
}

describe("Toast", () => {
  it("muestra el título, un enlace Ver y se puede cerrar", () => {
    render(<ToastProvider><Demo href="/operaciones/facturacion/x" /></ToastProvider>);
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByText("Venta #4 emitida")).toBeTruthy();
    expect(screen.getByText("Ver").getAttribute("href")).toBe("/operaciones/facturacion/x");
    fireEvent.click(screen.getByLabelText("Cerrar aviso"));
    expect(screen.queryByText("Venta #4 emitida")).toBeNull();
  });
  it("sin enlace se cierra solo a los 4 segundos", () => {
    vi.useFakeTimers();
    render(<ToastProvider><Demo /></ToastProvider>);
    fireEvent.click(screen.getByText("go"));
    act(() => { vi.advanceTimersByTime(4500); });
    expect(screen.queryByText("Venta #4 emitida")).toBeNull();
  });
  it("con enlace no se cierra solo: hay que darle tiempo de pulsar Ver", () => {
    vi.useFakeTimers();
    render(<ToastProvider><Demo href="/operaciones/facturacion/x" /></ToastProvider>);
    fireEvent.click(screen.getByText("go"));
    act(() => { vi.advanceTimersByTime(4500); });
    expect(screen.getByText("Venta #4 emitida")).toBeTruthy();
  });
});
```
Run: `npx vitest run src/components/ui/toast.test.tsx` → FAIL.

- [ ] **Step 2: Implementar `src/components/ui/toast.tsx`**

```tsx
"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { CircleCheck, TriangleAlert, X } from "lucide-react";

export type ToastInput = { title: string; description?: string; tone?: "success" | "error"; href?: string; hrefLabel?: string };
type Toast = ToastInput & { id: number };
type Ctx = { toast: (t: ToastInput) => void };

const ToastCtx = createContext<Ctx | null>(null);
const DURATION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);
  const toast = useCallback((t: ToastInput) => {
    const id = ++seq.current;
    setItems((xs) => [...xs.slice(-2), { ...t, id }]); // máximo 3 visibles
    // Un aviso con enlace no se va solo: el usuario necesita tiempo para pulsar «Ver».
    if (!t.href) timers.current.set(id, setTimeout(() => dismiss(id), DURATION_MS));
  }, [dismiss]);
  // Al desmontar, ningún temporizador queda vivo tocando estado de un árbol que ya no existe.
  useEffect(() => () => { for (const t of timers.current.values()) clearTimeout(t); timers.current.clear(); }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-20 z-[60] flex flex-col items-center gap-2 lg:inset-x-auto lg:bottom-24 lg:right-6 lg:items-end">  {/* bottom-24: libra el FAB de Vender */}
        {items.map((t) => (
          <div key={t.id}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm shadow-lg">
            {t.tone === "error"
              ? <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#dc2626]" strokeWidth={2} aria-hidden="true" />
              : <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0f766e] dark:text-[#6ee7b7]" strokeWidth={2} aria-hidden="true" />}
            <div className="min-w-0 flex-1">
              <p className="break-words font-semibold text-[var(--text)]">{t.title}</p>
              {t.description && <p className="break-words text-xs text-[var(--text-soft)]">{t.description}</p>}
              {t.href && <Link href={t.href} onClick={() => dismiss(t.id)} className="mt-1 inline-block text-xs font-semibold text-[#0e7490] dark:text-[#5eead4]">{t.hrefLabel ?? "Ver"}</Link>}
            </div>
            <button type="button" aria-label="Cerrar aviso" onClick={() => dismiss(t.id)}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--text-soft)] hover:bg-[var(--bg)]">
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
```
Run el test → PASS (3).

- [ ] **Step 3: Test de flash (falla)**

`tests/flash.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { withFlash, flashMessage, flashFor } from "@/lib/flash";

describe("flash", () => {
  it("withFlash añade la clave (y el argumento) a la URL", () => {
    expect(withFlash("/operaciones/facturacion/abc", "venta-emitida", "4")).toBe("/operaciones/facturacion/abc?flash=venta-emitida&arg=4");
    expect(withFlash("/clientes?page=2", "cliente-creado")).toBe("/clientes?page=2&flash=cliente-creado");
  });
  it("flashMessage traduce la clave a texto; desconocida → null", () => {
    expect(flashMessage("venta-emitida", "4")).toEqual({ title: "Venta #4 emitida", description: "Se asignó el número y se descontó el stock." });
    expect(flashMessage("cliente-creado", null)?.title).toBe("Cliente creado");
    expect(flashMessage("lo-que-sea", null)).toBeNull();
  });
  it("un arg que no es un número se descarta (viene de la URL)", () => {
    expect(flashMessage("venta-emitida", "0 — llame al 0800")?.title).toBe("Venta emitida");
  });
  it("flashFor no necesita `!`: la clave es conocida", () => {
    expect(flashFor("abono-registrado").title).toBe("Abono registrado");
    expect(flashFor("venta-emitida", 12).title).toBe("Venta #12 emitida");
  });
});
```
Run: `npx vitest run tests/flash.test.ts` → FAIL.

- [ ] **Step 4: Implementar `src/lib/flash.ts`**

```ts
// Avisos de éxito que sobreviven a un redirect: la acción redirige a `?flash=clave&arg=…`
// y <FlashToast> (cliente) los muestra y limpia la URL.
export type FlashKey =
  | "venta-emitida" | "venta-borrador" | "venta-borrador-eliminado" | "venta-anulada"
  | "cliente-creado" | "cliente-guardado" | "cliente-archivado" | "cliente-reactivado"
  | "producto-creado" | "producto-guardado" | "producto-archivado" | "producto-reactivado"
  | "presupuesto-enviado" | "presupuesto-borrador" | "presupuesto-eliminado" | "presupuesto-aceptado" | "presupuesto-rechazado" | "presupuesto-convertido"
  | "abono-registrado" | "abono-anulado" | "vencimiento-guardado" | "stock-ajustado";

const MESSAGES: Record<FlashKey, (arg: string | null) => { title: string; description?: string }> = {
  "venta-emitida": (n) => ({ title: `Venta${n ? ` #${n}` : ""} emitida`, description: "Se asignó el número y se descontó el stock." }),
  "venta-borrador": () => ({ title: "Borrador guardado", description: "No descuenta stock ni toma número hasta que la emitas." }),
  "venta-borrador-eliminado": () => ({ title: "Borrador eliminado" }),
  "venta-anulada": (n) => ({ title: `Venta${n ? ` #${n}` : ""} anulada`, description: "El stock volvió al inventario." }),
  "cliente-creado": () => ({ title: "Cliente creado" }),
  "cliente-guardado": () => ({ title: "Cambios guardados" }),
  "cliente-archivado": () => ({ title: "Cliente archivado", description: "Ya no aparece en las listas; su historial se conserva." }),
  "cliente-reactivado": () => ({ title: "Cliente reactivado" }),
  "producto-creado": () => ({ title: "Producto creado", description: "Carga sus existencias en Inventario cuando quieras." }),
  "producto-guardado": () => ({ title: "Cambios guardados" }),
  "producto-archivado": () => ({ title: "Producto archivado", description: "Ya no aparece para vender; su historial se conserva." }),
  "producto-reactivado": () => ({ title: "Producto reactivado" }),
  "presupuesto-enviado": (n) => ({ title: `Presupuesto${n ? ` #${n}` : ""} enviado` }),
  "presupuesto-borrador": () => ({ title: "Borrador guardado" }),
  "presupuesto-eliminado": () => ({ title: "Presupuesto eliminado" }),
  "presupuesto-aceptado": () => ({ title: "Presupuesto marcado como aceptado" }),
  "presupuesto-rechazado": () => ({ title: "Presupuesto marcado como rechazado" }),
  "presupuesto-convertido": () => ({ title: "Presupuesto convertido en venta", description: "Revisa la venta y emítela cuando esté lista." }),
  "abono-registrado": () => ({ title: "Abono registrado" }),
  "abono-anulado": () => ({ title: "Abono anulado", description: "El saldo de la venta se restauró." }),
  "vencimiento-guardado": () => ({ title: "Vencimiento guardado" }),
  "stock-ajustado": () => ({ title: "Existencias actualizadas" }),
};

export function withFlash(path: string, key: FlashKey, arg?: string | number | null): string {
  const sep = path.includes("?") ? "&" : "?";
  const a = arg == null || arg === "" ? "" : `&arg=${encodeURIComponent(String(arg))}`;
  return `${path}${sep}flash=${key}${a}`;
}

// El `arg` llega de la URL: solo se acepta un número corto (es un número de documento).
const ARG_OK = /^\d{1,9}$/;

export function flashMessage(key: string, arg: string | null): { title: string; description?: string } | null {
  const fn = (MESSAGES as Record<string, (a: string | null) => { title: string; description?: string }>)[key];
  return fn ? fn(arg && ARG_OK.test(arg) ? arg : null) : null;
}

/** Para llamadas internas con clave conocida (sin `!`). */
export function flashFor(key: FlashKey, arg: string | number | null = null): { title: string; description?: string } {
  return MESSAGES[key](arg == null ? null : String(arg));
}
```
Run el test → PASS (4).

- [ ] **Step 5: `FlashToast` y montaje en el shell**

`src/components/shell/flash-toast.tsx`:
```tsx
"use client";
import { useEffect } from "react";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { flashMessage } from "@/lib/flash";

/** Lee ?flash=clave&arg=… tras un redirect, muestra el toast y limpia la URL sin navegar
 *  (history.replaceState se integra con el router de Next y evita un segundo render del servidor). */
export function FlashToast() {
  const sp = useSearchParams();
  const pathname = usePathname();
  const { toast } = useToast();
  const key = sp.get("flash");
  const arg = sp.get("arg");
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!key) return;
    const token = `${key}|${arg ?? ""}`;
    if (shown.current === token) return; // StrictMode re-ejecuta el efecto con las mismas props
    shown.current = token;
    const msg = flashMessage(key, arg);
    if (msg) toast(msg);
    const next = new URLSearchParams(sp.toString());
    next.delete("flash"); next.delete("arg");
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }, [key, arg, sp, pathname, toast]);
  return null;
}
```
`src/components/shell/app-shell.tsx`: envolver el árbol en el provider y montar el lector:
```tsx
import { Suspense } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { FlashToast } from "@/components/shell/flash-toast";
// …
  return (
    <ToastProvider>
      <Suspense fallback={null}><FlashToast /></Suspense>
      <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
        {/* … todo lo que ya había … */}
      </div>
    </ToastProvider>
  );
```
(El `import { useEffect, useState } from "react"` existente pasa a `import { Suspense, useEffect, useState } from "react"`.)

- [ ] **Step 6: Acciones que redirigen pasan flash**

`src/app/(app)/clientes/actions.ts`: `redirect(withFlash(`/clientes/${id}`, "cliente-creado"))` en `createClientAction`; `redirect(withFlash(`/clientes/${id}`, "cliente-guardado"))` en `updateClientAction`. (`import { withFlash } from "@/lib/flash";`)

`src/app/(app)/operaciones/productos/actions.ts`: `withFlash(`${LIST}/${id}`, "producto-creado")` y `"producto-guardado"`.

`src/app/(app)/operaciones/facturacion/actions.ts`:
- `submitSaleAction`: antes del `redirect` final, obtener el número si emitió: 
  ```ts
  // `emitSale` devuelve el número asignado (su update ya hace select("id, number")): sin consulta extra.
  let number: number | null = null;
  if (intent === "emit") number = await m.emitSale(sb, saleId, pay.data, todayISO(timezone));
  redirect(withFlash(`${LIST}/${saleId}`, intent === "emit" ? "venta-emitida" : "venta-borrador", number));
  ```
- `deleteDraftAction`: `redirect(withFlash(LIST, "venta-borrador-eliminado"))`.
- `voidSaleAction` no redirige: el toast lo dispara el `ConfirmDialog` (Task 10).

`src/app/(app)/operaciones/presupuestos/actions.ts`:
- `submitQuoteAction`: igual que ventas con `"presupuesto-enviado"` (número devuelto por `sendQuote`) / `"presupuesto-borrador"`.
- `deleteQuoteAction`: `withFlash(LIST, "presupuesto-eliminado")`.
- `convertQuoteAction`: `redirect(withFlash(`/operaciones/facturacion/${saleId}/editar`, "presupuesto-convertido"))`.
- `setQuoteStatusAction` no redirige: toast desde el cliente (Task 10).

- [ ] **Step 7: Formularios in-place disparan el toast**

`src/components/cobros/payment-form.tsx`: `const { toast } = useToast();` y el efecto:
```ts
useEffect(() => { if (state.ok) { setOpen(false); toast(flashFor("abono-registrado")); } }, [state]);
```
(imports: `useToast` de `@/components/ui/toast`, `flashFor` de `@/lib/flash` — tipado, sin `!`.)

`src/components/inventario/stock-adjust-form.tsx`: igual con `"stock-ajustado"`.

`src/components/cobros/due-date-field.tsx` pasa a cliente con transición:
```tsx
"use client";
import { useTransition } from "react";
import { setDueDateAction } from "@/app/(app)/finanzas/cuentas-por-cobrar/actions";
import { useToast } from "@/components/ui/toast";
import { flashFor } from "@/lib/flash";
import { formatDateOnly } from "@/lib/format";

export function DueDateField({ saleId, dueDate, canEdit }: { saleId: string; dueDate: string | null; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const inputCls = "h-9 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";
  if (!canEdit) return (
    <p className="text-sm"><span className="text-[var(--text-soft)]">Vencimiento: </span>
      <span className="text-[var(--text)]">{formatDateOnly(dueDate)}</span></p>
  );
  return (
    <form className="flex items-center gap-2"
      onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => { try { await setDueDateAction(fd); toast(flashFor("vencimiento-guardado")); } catch { toast({ title: "No se pudo guardar el vencimiento", tone: "error" }); } }); }}>
      <input type="hidden" name="saleId" value={saleId} />
      <label htmlFor={`due-${saleId}`} className="text-sm text-[var(--text-soft)]">Vencimiento</label>
      <input id={`due-${saleId}`} type="date" name="dueDate" defaultValue={dueDate ?? ""} className={inputCls} />
      <button disabled={pending} className="rounded-[10px] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)] disabled:opacity-60">{pending ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}
```

- [ ] **Step 8: Typecheck, tests, build y commit**

Run: `npx tsc --noEmit` → sin errores. `npx vitest run` → PASS. `npm run build` → OK.
```bash
git add -A src tests/flash.test.ts
git commit -m "feat(ui): toasts de éxito tras guardar/emitir/abonar (provider propio + flash por URL)"
```

---

### Task 10: `ConfirmDialog` en las siete acciones destructivas

**Files:**
- Create: `src/components/ui/confirm-dialog.tsx`, `src/components/ui/confirm-dialog.test.tsx`
- Modify: `src/app/(app)/clientes/[id]/page.tsx`, `src/app/(app)/operaciones/productos/[id]/page.tsx`, `src/app/(app)/operaciones/presupuestos/[id]/page.tsx`, `src/app/(app)/operaciones/facturacion/[id]/page.tsx`, `src/components/cobros/payments-history.tsx`
- Modify: `src/app/(app)/clientes/actions.ts`, `src/app/(app)/operaciones/productos/actions.ts` (devolver flash para el toast)

- [ ] **Step 1: Test jsdom (falla)**

`src/components/ui/confirm-dialog.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ToastProvider } from "./toast";
import { ConfirmDialog } from "./confirm-dialog";

function setup(action = vi.fn(async () => {})) {
  render(
    <ToastProvider>
      <ConfirmDialog action={action} payload={{ id: "abc" }} title="¿Anular la venta #2?"
        description="Repone el stock y no se puede deshacer." confirmLabel="Anular" tone="danger"
        successToast={{ title: "Venta #2 anulada" }} triggerClassName="btn">
        Anular
      </ConfirmDialog>
    </ToastProvider>,
  );
  return action;
}

describe("ConfirmDialog", () => {
  it("abre al pulsar y cancela sin llamar a la acción", () => {
    const action = setup();
    fireEvent.click(screen.getByText("Anular"));
    expect(screen.getByText("¿Anular la venta #2?")).toBeTruthy();
    fireEvent.click(screen.getByText("Cancelar"));
    expect(action).not.toHaveBeenCalled();
  });
  it("confirma: llama a la acción con el payload como FormData y muestra el toast", async () => {
    const action = setup();
    fireEvent.click(screen.getByText("Anular"));
    fireEvent.click(screen.getByRole("button", { name: "Anular", hidden: true }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const fd = action.mock.calls[0][0] as FormData;
    expect(fd.get("id")).toBe("abc");
    await waitFor(() => expect(screen.getByText("Venta #2 anulada")).toBeTruthy());
  });
});
```
Nota: con el diálogo abierto hay dos botones «Anular» (el disparador detrás del overlay queda `aria-hidden`); `getByRole(..., { hidden: true })` encuentra el del modal; si devuelve el disparador, usar `screen.getAllByRole("button", { name: "Anular", hidden: true }).at(-1)!`.
Run: `npx vitest run src/components/ui/confirm-dialog.test.tsx` → FAIL.

- [ ] **Step 2: Implementar `src/components/ui/confirm-dialog.tsx`**

```tsx
"use client";
import { useState, useTransition, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { TriangleAlert } from "lucide-react";
import { useToast, type ToastInput } from "@/components/ui/toast";

/** Confirmación antes de una acción irreversible. Reemplaza <form action={…}> + botón directo.
 *  - `action` es una Server Action (fd: FormData) => Promise<void>; `payload` son sus campos ocultos.
 *  - Nunca usar confirm() nativo: la PWA lo suprime en silencio. */
export function ConfirmDialog({ action, payload, title, description, confirmLabel, tone = "danger", successToast, triggerClassName, children }: {
  action: (fd: FormData) => Promise<void>; payload: Record<string, string>;
  title: string; description: string; confirmLabel: string; tone?: "danger" | "primary";
  successToast?: ToastInput; triggerClassName?: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { toast } = useToast();

  function confirm() {
    const fd = new FormData();
    for (const [k, v] of Object.entries(payload)) fd.append(k, v);
    start(async () => {
      await action(fd);
      if (successToast) toast(successToast);
      setOpen(false);
    });
  }

  const confirmCls = tone === "danger"
    ? "bg-[#dc2626] text-white hover:bg-[#b91c1c]"
    : "bg-gradient-to-br from-[#0e7490] to-[#14b8a6] text-white";

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!pending) setOpen(o); }}>
      <Dialog.Trigger asChild><button type="button" className={triggerClassName}>{children}</button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
          <div className="flex items-start gap-3">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone === "danger" ? "bg-[#dc2626]/10 text-[#dc2626]" : "bg-[#0e7490]/10 text-[#0e7490]"}`}>
              <TriangleAlert className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <Dialog.Title className="text-base font-bold text-[var(--text)]">{title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[var(--text-soft)]">{description}</Dialog.Description>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button type="button" disabled={pending} className="rounded-[10px] border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] disabled:opacity-60">Cancelar</button>
            </Dialog.Close>
            <button type="button" onClick={confirm} disabled={pending} className={`rounded-[10px] px-4 py-2 text-sm font-semibold disabled:opacity-60 ${confirmCls}`}>
              {pending ? "Procesando…" : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```
Run el test → PASS (2).

- [ ] **Step 3: Venta — anular y eliminar borrador** (`src/app/(app)/operaciones/facturacion/[id]/page.tsx`)

Reemplazar el `<form action={deleteDraftAction}>…</form>` por:
```tsx
<ConfirmDialog action={deleteDraftAction} payload={{ id: sale.id }}
  title="¿Eliminar este borrador?" description="Se borra la venta en preparación. No afecta stock ni numeración."
  confirmLabel="Eliminar borrador" triggerClassName={dangerBtn}>
  Eliminar borrador
</ConfirmDialog>
```
y el `<form action={voidSaleAction}>…</form>` por:
```tsx
<ConfirmDialog action={voidSaleAction} payload={{ id: sale.id, clientId: sale.client_id ?? "" }}
  title={`¿Anular la venta #${sale.number}?`} description="El stock vuelve al inventario y la venta queda anulada. No se puede deshacer."
  confirmLabel="Anular venta" successToast={flashMessage("venta-anulada", String(sale.number))!} triggerClassName={dangerBtn}>
  Anular
</ConfirmDialog>
```
con `const dangerBtn = "rounded-[10px] border border-[#dc2626]/40 px-3 py-2 text-sm font-medium text-[#dc2626] hover:bg-[#dc2626]/5";` definido arriba del `return`. Imports: `ConfirmDialog` de `@/components/ui/confirm-dialog`, `flashMessage` de `@/lib/flash`. (Al eliminar el borrador la acción redirige con flash; por eso ese diálogo no lleva `successToast`.)

- [ ] **Step 4: Abono — anular** (`src/components/cobros/payments-history.tsx`)

Reemplazar el `<form action={voidPaymentAction}>…</form>` por:
```tsx
<ConfirmDialog action={voidPaymentAction} payload={{ id: p.id, saleId }}
  title={`¿Anular el abono de ${formatMoney(p.amount, currency)}?`} description="El saldo de la venta vuelve a subir. No se puede deshacer."
  confirmLabel="Anular abono" successToast={flashMessage("abono-anulado", null)!}
  triggerClassName="text-xs font-medium text-[var(--text-soft)] hover:text-[#dc2626]">
  Anular
</ConfirmDialog>
```
El componente ya es de servidor sin hooks; `ConfirmDialog` es cliente y acepta la Server Action como prop (patrón válido en Next).

- [ ] **Step 5: Cliente y producto — archivar** (reactivar sigue directo)

En `src/app/(app)/clientes/[id]/page.tsx` reemplazar el `<form action={archiveClientAction}>` por:
```tsx
{canArchiveClient(role) && (c.active ? (
  <ConfirmDialog action={archiveClientAction} payload={{ id: c.id, active: "false" }}
    title={`¿Archivar a ${c.name}?`} description="Deja de aparecer en listas y al vender. Su historial y sus ventas se conservan; puedes reactivarlo cuando quieras."
    confirmLabel="Archivar" successToast={flashMessage("cliente-archivado", null)!} triggerClassName={secondaryBtn}>
    Archivar
  </ConfirmDialog>
) : (
  <form action={archiveClientAction}>
    <input type="hidden" name="id" value={c.id} /><input type="hidden" name="active" value="true" />
    <button className={secondaryBtn}>Reactivar</button>
  </form>
))}
```
con `const secondaryBtn = "rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]";`.
Mismo cambio en `src/app/(app)/operaciones/productos/[id]/page.tsx` con `archiveProductAction`, título `¿Archivar ${p.name}?`, descripción «Deja de aparecer en el catálogo y al vender. Sus existencias y movimientos se conservan.», toast `"producto-archivado"`.

- [ ] **Step 6: Presupuesto — eliminar y marcar rechazado** (`src/app/(app)/operaciones/presupuestos/[id]/page.tsx`)

```tsx
<ConfirmDialog action={deleteQuoteAction} payload={{ id: quote.id }}
  title="¿Eliminar este presupuesto?" description="Se borra el borrador. No afecta ventas ni stock."
  confirmLabel="Eliminar" triggerClassName={`${btn} text-[#dc2626]`}>Eliminar</ConfirmDialog>
// …
<ConfirmDialog action={setQuoteStatusAction} payload={{ id: quote.id, status: "rejected" }}
  title={`¿Marcar el presupuesto #${quote.number} como rechazado?`} description="Queda cerrado y no podrá convertirse en venta."
  confirmLabel="Marcar rechazado" successToast={flashMessage("presupuesto-rechazado", null)!} triggerClassName={`${btn} text-[#dc2626]`}>
  Marcar rechazado
</ConfirmDialog>
```
«Marcar aceptado» sigue como form directo pero gana toast: envolverlo igual que `DueDateField` (cliente con `useTransition`) o, más simple, dejarlo como está (sin toast) — **decisión: dejarlo como está**; el cambio de chip a «Aceptado» ya es feedback visible.

- [ ] **Step 7: Verificación manual en el navegador**

```bash
npm run dev   # en otra terminal; http://localhost:3000, demo@kontify.app / Kontify2026!
```
Con Playwright (`/home/fabriziodp/coa-lab/node_modules/playwright/index.mjs`) o a mano: en la venta #3 pulsar «Anular» → aparece el modal con título «¿Anular la venta #3?» → «Cancelar» cierra sin cambios → «Anular» de nuevo → «Anular venta» → chip pasa a «Anulada», toast «Venta #3 anulada». Luego nueva venta → «Emitir» → «Confirmar emisión»: solo ese botón dice «Emitiendo…», redirige al detalle con toast «Venta #4 emitida». Parar el servidor al terminar (`pkill -f "next[ ]dev"`).

- [ ] **Step 8: Typecheck, tests, commit**

Run: `npx tsc --noEmit` → sin errores. `npx vitest run` → PASS.
```bash
git add -A src
git commit -m "feat(ui): confirmación antes de anular, eliminar y archivar (ConfirmDialog, sin confirm() nativo)"
```

---

### Task 11: «Requieren atención» con datos reales

**Files:**
- Create: `src/lib/dashboard/attention.ts`
- Modify: `src/components/dashboard/attention-list.tsx`, `src/app/(app)/dashboard/page.tsx`
- Test: `tests/attention.test.ts`

- [ ] **Step 1: Test de integración (falla)**

`tests/attention.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import type { SaleSaveInput } from "@/lib/ventas/schema";
import { createDraft, emitSale } from "@/lib/ventas/mutations";
import { attentionItems } from "@/lib/dashboard/attention";

async function makeTenant(name: string) {
  const u = await newUserClient();
  const { data: tenantId } = await u.client.rpc("bootstrap_tenant", {
    p_name: name, p_slug: `${name}-${Date.now()}-${Math.random()}`, p_full_name: name,
  });
  return { ...u, tenantId: tenantId as string };
}
async function mainBranch(t: any) {
  const { data } = await t.client.from("branches").select("id").eq("tenant_id", t.tenantId).eq("is_main", true).single();
  return data!.id as string;
}
const saleOf = (branchId: string, items: SaleSaveInput["items"], clientId: string | null = null): SaleSaveInput =>
  ({ clientId, branchId, globalDiscountPct: 0, notes: undefined, items });

describe("attentionItems", () => {
  it("sin datos → lista vacía", async () => {
    const a = await makeTenant("att0");
    expect(await attentionItems(a.client, "2026-10-09")).toEqual([]);
  });
  it("venta vencida, producto agotado y producto bajo mínimo, en ese orden, con enlace", async () => {
    const a = await makeTenant("att"); const b = await mainBranch(a);
    const { data: cli } = await a.client.from("clients").insert({ tenant_id: a.tenantId, kind: "company", name: "El Sol" }).select("id").single();
    const { data: p1 } = await a.client.from("products").insert({ tenant_id: a.tenantId, kind: "good", name: "Cloro", price: 2, min_stock: 10 }).select("id").single();
    const { data: p2 } = await a.client.from("products").insert({ tenant_id: a.tenantId, kind: "good", name: "Refresco", price: 2, min_stock: 12 }).select("id").single();
    await a.client.from("stock_movements").insert({ tenant_id: a.tenantId, product_id: p2!.id, branch_id: b, qty_delta: 5, type: "adjustment", reason: "inicial", created_by: a.id });
    // Cloro: sin existencias (agotado). Refresco: 5 ≤ mín 12 (bajo).
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, [
      { productId: p1!.id, description: "Cloro", quantity: 1, unitPrice: 10, discountPct: 0, taxRate: 0 },
    ], cli!.id));
    await emitSale(a.client, id, { paymentType: "credito", dueDate: "2026-10-01" });

    const items = await attentionItems(a.client, "2026-10-09");
    expect(items.map((i) => i.kind)).toEqual(["vencida", "agotado", "bajo"]);
    expect(items[0]).toMatchObject({ tone: "danger", href: `/operaciones/facturacion/${id}` });
    expect(items[0].title).toMatch(/Venta #1 vencida/);
    expect(items[0].detail).toMatch(/El Sol/);
    expect(items[1]).toMatchObject({ tone: "danger", title: "Cloro agotado", href: "/operaciones/inventario" });
    expect(items[2]).toMatchObject({ tone: "warn", title: "Refresco con stock bajo" });
    expect(items[2].detail).toMatch(/5 .* 12/);
  });
});
```
Si `emitSale` con `paymentType: "credito"` exige `paymentMethod`, pasar `paymentMethod: undefined`. Si `stock_movements` exige `created_by` distinto, mirar `tests/inventario.test.ts` y copiar su forma de insertar.
Run: `npx vitest run tests/attention.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 2: Implementar `src/lib/dashboard/attention.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { round2 } from "@/lib/ventas/totals";
import { formatMoney, formatDateOnly } from "@/lib/format";
import { listStock } from "@/lib/inventario/queries";

export type AttentionItem = {
  kind: "vencida" | "agotado" | "bajo";
  tone: "danger" | "warn"; title: string; detail: string; href: string;
};
const MAX = 8;

/** Ventas vencidas (más antiguas primero), productos agotados y bajo mínimo. Degrada a [] ante error. */
export async function attentionItems(sb: SupabaseClient, today: string): Promise<AttentionItem[]> {
  try {
    const out: AttentionItem[] = [];
    const { data: sales } = await sb.from("sales").select("id, number, balance, due_date, currency, clients(name)")
      .eq("status", "issued").gt("balance", 0).lt("due_date", today).order("due_date").limit(MAX);
    for (const s of (sales ?? []) as any[]) {
      out.push({
        kind: "vencida", tone: "danger",
        title: `Venta #${s.number} vencida`,
        detail: `${s.clients?.name ?? "Consumidor final"} · saldo ${formatMoney(round2(Number(s.balance)), s.currency)} · venció el ${formatDateOnly(s.due_date)}`,
        href: `/operaciones/facturacion/${s.id}`,
      });
    }
    const stock = await listStock(sb);
    for (const r of stock.filter((x) => x.status === "agotado")) {
      if (out.length >= MAX) break;
      out.push({ kind: "agotado", tone: "danger", title: `${r.name} agotado`, detail: `Existencia ${r.qty} · mínimo ${r.minStock}`, href: "/operaciones/inventario" });
    }
    for (const r of stock.filter((x) => x.status === "bajo")) {
      if (out.length >= MAX) break;
      out.push({ kind: "bajo", tone: "warn", title: `${r.name} con stock bajo`, detail: `Existencia ${r.qty} · mínimo ${r.minStock}`, href: "/operaciones/inventario" });
    }
    return out;
  } catch { return []; }
}
```
Run el test → PASS (2). Si el orden entre «agotado» y «bajo» sale invertido por `listStock` (ordena por nombre), el filtro por estado ya lo separa; si falla por `minStock` en `detail`, revisar que `listStock` devuelve `minStock` numérico.

- [ ] **Step 3: `AttentionList` con enlace y tono**

`src/components/dashboard/attention-list.tsx`:
```tsx
import Link from "next/link";
import { CircleCheck, TriangleAlert, CircleAlert } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import type { AttentionItem } from "@/lib/dashboard/attention";

export type { AttentionItem };

export function AttentionList({ items }: { items: AttentionItem[] }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="mb-2 text-sm font-bold text-[var(--text)]">Requieren atención</p>
      {items.length === 0 ? (
        <EmptyState icon={CircleCheck} title="Todo en orden" hint="No hay ventas vencidas ni productos por reponer." />
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => {
            const Icon = it.tone === "danger" ? CircleAlert : TriangleAlert;
            const color = it.tone === "danger" ? "text-[#dc2626]" : "text-[#b45309] dark:text-[#fbbf24]";
            return (
              <li key={i}>
                <Link href={it.href} className="flex items-start gap-2 rounded-lg border border-[var(--border)] p-2.5 hover:bg-[var(--bg)]">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} strokeWidth={2} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text)]">{it.title}</p>
                    <p className="text-xs text-[var(--text-soft)]">{it.detail}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Dashboard la alimenta**

En `src/app/(app)/dashboard/page.tsx`:
```ts
import { attentionItems } from "@/lib/dashboard/attention";
import { todayISO } from "@/lib/tz";
// junto a las otras consultas:
const attention = await attentionItems(supabase, todayISO(tz));
// al final:
<AttentionList items={attention} />
```

- [ ] **Step 5: Typecheck, tests, commit**

Run: `npx tsc --noEmit` → sin errores. `npx vitest run` → PASS.
```bash
git add src/lib/dashboard/attention.ts src/components/dashboard/attention-list.tsx "src/app/(app)/dashboard/page.tsx" tests/attention.test.ts
git commit -m "feat(dashboard): 'Requieren atención' con ventas vencidas y productos agotados/bajo mínimo"
```

---

### Task 12: Verificación final y entrega

- [ ] **Step 1: Suite completa, typecheck y build**

```bash
npx vitest run && npx tsc --noEmit && npm run build
```
Expected: todo PASS, 0 errores, build limpio.

- [ ] **Step 2: Recorrido visual** (servidor con `npm run dev`; usuario `demo@kontify.app / Kontify2026!`)

1. Dashboard: «Ventas de la semana», «Top productos», «Utilidad del mes» y «Ventas del mes» cuentan las mismas ventas; «Requieren atención» lista la venta vencida, Cloro agotado y Refresco bajo, cada una clicable.
2. `/operaciones/facturacion`: #1 «Pagada» verde con saldo gris; #3 «Pendiente» ámbar; una vencida «Vencida» roja con saldo rojo; anulada «Anulada» con saldo «—»; filtro «Vencidas» funciona.
3. Detalle de la vencida: bloque Pago dice «Vencida · saldo … · venció el dd/mm/aaaa»; el detalle de #1 (pagada) no muestra el editor de vencimiento.
4. `/reportes/ventas` abre con «Este mes» marcado y las fechas llenas; «Hoy» muestra las ventas del día en hora de Venezuela.
5. Cuentas por cobrar: «Vto. más antiguo» muestra la fecha exacta del vencimiento (antes salía un día antes).
6. Anular / Eliminar / Archivar abren modal; Cancelar no hace nada; confirmar muestra toast.
7. Móvil 390px: toasts aparecen encima de la barra inferior; el modal cabe.
Parar el servidor: `pkill -f "next[ ]dev"`.

- [ ] **Step 3: Merge a master**

```bash
git checkout master && git merge --no-ff feat/ux-fase-a -m "Merge feat/ux-fase-a: Fase A Confianza (tz por empresa, estado de pago, confirmaciones, toasts, atención real)"
git push origin master
```

- [ ] **Step 4: Actualizar la memoria del proyecto** (`project_kontify.md`): Fase A mergeada, hash del merge, migración 0027, y que las Fases B y C siguen.

---

## Autorrevisión del plan contra la spec (sección 5, Fase A)

| Requisito de la spec | Tarea |
|---|---|
| ConfirmDialog en 7 acciones | Task 10 (anular venta, eliminar borrador, anular abono, archivar cliente, archivar producto, eliminar presupuesto, marcar rechazado) |
| Toasts | Task 9 |
| Fix `pending` doble | Task 8 |
| Estado de pago + Vencida en lista y detalle | Task 7 |
| Saldo oculto en anuladas | Task 7 Step 8 |
| Texto viejo de Cobros | Task 7 Step 9 |
| «Requieren atención» real | Task 11 |
| Zona horaria por empresa (B2) | Tasks 1–6 |
| Vencimiento solo con saldo (hallazgo menor) | Task 7 Step 9 |
| Columna DATE corrida un día (hallazgo de la implementación) | Task 4 + Task 6 |
| Escritura de paid_at y regla «no futura» con el día de la empresa (hallazgo de la revisión de Task 5) | Task 6b |

Fuera de alcance (Fases B/C): ModuleHeader, EmptyState v2, FieldHelp, GettingStarted, renombre Facturación→Ventas, buscador global, móvil de líneas de venta, contraste `--text-soft`.
