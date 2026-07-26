# Kontify — Reportes / Ventas y Utilidad (Plan 9) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reporte de Ventas por período (resumen + por día/producto/vendedor/cliente) con utilidad basada en costo snapshot, y llenar los huecos del dashboard (Utilidad del mes, Ventas de la semana, Top productos).

**Architecture:** Nueva columna `sale_items.unit_cost` poblada server-side desde `products.cost` en `replaceItems`. Capa `src/lib/reportes/*` con `salesReport` (fetch RLS-scoped + agregación en JS) + helpers de rango puros. UI con barras simples (sin librería). El KPI de utilidad se gatea a roles que ven costo.

**Tech Stack:** Next.js (custom — ver `AGENTS.md`), RSC + Server Components, Supabase (Postgres + RLS), Zod (no aplica aquí), Vitest, Tailwind 4.

**Prerequisito de entorno:** Supabase local corriendo. Migraciones/tests con `npx supabase db reset`.

**Referencia viva:** patrón de queries con degradación segura de `src/lib/ventas/queries.ts` y `src/lib/inventario/queries.ts`; `round2` de `@/lib/ventas/totals`; `formatMoney`, `getTenantCurrency`, `KpiCard`, `EmptyState`, `canManageProducts`, `canAccess`.

---

## Estructura de archivos

**Migración (crear):** `supabase/migrations/0026_sale_item_cost.sql`.

**Capa de datos (crear):** `src/lib/reportes/ranges.ts` (+ test), `src/lib/reportes/queries.ts`.

**Modificar:** `src/lib/ventas/mutations.ts` (`replaceItems` puebla `unit_cost`); `src/app/(app)/dashboard/page.tsx` (Utilidad del mes / Ventas de la semana / Top productos); `src/app/(app)/reportes/ventas/page.tsx` (reemplaza placeholder).

**UI (crear):** `src/components/reportes/period-selector.tsx`, `src/components/reportes/bar-chart.tsx`.

**Tests (crear):** `src/lib/reportes/ranges.test.ts`, `tests/reportes.test.ts`.

---

## Task 1: Migración — unit_cost en sale_items

**Files:**
- Create: `supabase/migrations/0026_sale_item_cost.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 0026_sale_item_cost.sql
-- Snapshot del costo unitario al vender (para utilidad/margen). Nullable: se puebla
-- server-side desde products.cost; líneas de texto libre o ventas viejas quedan en null.
alter table public.sale_items add column unit_cost numeric(14,2);
```

- [ ] **Step 2: Aplicar migraciones**

Run: `npx supabase db reset`
Expected: sin error; en el log aparece `0026`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0026_sale_item_cost.sql
git commit -m "feat(reportes): migración sale_items.unit_cost (costo snapshot para utilidad)"
```

---

## Task 2: ranges.ts (TDD)

**Files:**
- Create: `src/lib/reportes/ranges.ts`
- Test: `src/lib/reportes/ranges.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from "vitest";
import { presetRange, monthRange, weekRange, addDays } from "./ranges";

// Miércoles 15 de julio de 2026 (Jul 1 2026 = miércoles → semana empieza lunes 13).
const ref = new Date(2026, 6, 15);

describe("reportes — ranges", () => {
  it("hoy", () => { expect(presetRange("hoy", ref)).toEqual({ from: "2026-07-15", to: "2026-07-15" }); });
  it("esta semana (lunes → hoy)", () => { expect(weekRange(ref)).toEqual({ from: "2026-07-13", to: "2026-07-15" }); });
  it("este mes (1 → hoy)", () => { expect(monthRange(ref)).toEqual({ from: "2026-07-01", to: "2026-07-15" }); });
  it("mes pasado (1 → último día)", () => { expect(presetRange("mes_pasado", ref)).toEqual({ from: "2026-06-01", to: "2026-06-30" }); });
  it("addDays cruza fin de mes", () => { expect(addDays("2026-07-31", 1)).toBe("2026-08-01"); });
});
```

- [ ] **Step 2: Correr el test — debe fallar**

Run: `npx vitest run src/lib/reportes/ranges.test.ts`
Expected: FAIL (no existe `./ranges`).

- [ ] **Step 3: Implementar**

```typescript
export type DateRange = { from: string; to: string };
export type Preset = "hoy" | "semana" | "mes" | "mes_pasado";

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return fmt(new Date(y, m - 1, d + n));
}

export function presetRange(preset: Preset, ref: Date): DateRange {
  const y = ref.getFullYear(), m = ref.getMonth(), day = ref.getDate();
  switch (preset) {
    case "hoy": { const t = fmt(ref); return { from: t, to: t }; }
    case "semana": {
      const dow = (ref.getDay() + 6) % 7; // 0 = lunes
      return { from: fmt(new Date(y, m, day - dow)), to: fmt(ref) };
    }
    case "mes": return { from: fmt(new Date(y, m, 1)), to: fmt(ref) };
    case "mes_pasado": return { from: fmt(new Date(y, m - 1, 1)), to: fmt(new Date(y, m, 0)) };
  }
}

export const monthRange = (ref: Date): DateRange => presetRange("mes", ref);
export const weekRange = (ref: Date): DateRange => presetRange("semana", ref);
```

- [ ] **Step 4: Correr el test — debe pasar**

Run: `npx vitest run src/lib/reportes/ranges.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reportes/ranges.ts src/lib/reportes/ranges.test.ts
git commit -m "feat(reportes): helpers de rango (presets + addDays) con test"
```

---

## Task 3: Costo snapshot en replaceItems

**Files:**
- Modify: `src/lib/ventas/mutations.ts`

- [ ] **Step 1: Reemplazar `replaceItems`**

En `src/lib/ventas/mutations.ts`, reemplazar toda la función `replaceItems` por:

```typescript
async function replaceItems(sb: SupabaseClient, saleId: string, tenantId: string, input: SaleSaveInput) {
  const { error: delErr } = await sb.from("sale_items").delete().eq("sale_id", saleId);
  if (delErr) throw delErr;
  if (input.items.length === 0) return;
  // Snapshot de costo: resuelve products.cost server-side (el cliente nunca envía el costo).
  const productIds = [...new Set(input.items.map((i) => i.productId).filter(Boolean))] as string[];
  const costMap = new Map<string, number | null>();
  if (productIds.length) {
    const { data: prods } = await sb.from("products").select("id, cost").in("id", productIds);
    for (const p of prods ?? []) costMap.set(p.id as string, p.cost != null ? Number(p.cost) : null);
  }
  const rows = input.items.map((i, idx) => ({
    tenant_id: tenantId, sale_id: saleId, product_id: i.productId ?? null,
    description: i.description, quantity: i.quantity, unit_price: i.unitPrice,
    discount_pct: i.discountPct, tax_rate: i.taxRate, position: idx,
    unit_cost: i.productId ? (costMap.get(i.productId) ?? null) : null,
  }));
  const { error } = await sb.from("sale_items").insert(rows);
  if (error) throw error;
}
```

- [ ] **Step 2: Aplicar migraciones y correr regresión**

Run: `npx supabase db reset && npx vitest run tests/ventas.test.ts tests/cobros.test.ts tests/inventario.test.ts tests/presupuestos.test.ts`
Expected: PASS (el snapshot de costo no cambia ningún assert existente; las líneas con producto ahora guardan `unit_cost`, las de texto libre `null`).

- [ ] **Step 3: Verificar tipos + commit**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

```bash
git add src/lib/ventas/mutations.ts
git commit -m "feat(reportes): replaceItems puebla unit_cost desde products.cost (server-side)"
```

---

## Task 4: queries.ts (salesReport + wrappers dashboard)

**Files:**
- Create: `src/lib/reportes/queries.ts`

(Se ejercita en los tests de integración de la Task 5.)

- [ ] **Step 1: Implementar**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import { round2 } from "@/lib/ventas/totals";
import { addDays, monthRange, weekRange, type DateRange } from "@/lib/reportes/ranges";

export type SalesReport = {
  summary: { count: number; revenue: number; utility: number; avgTicket: number; marginPct: number; costIncompleteCount: number };
  byDay: { date: string; revenue: number; utility: number }[];
  byProduct: { productId: string | null; name: string; qty: number; revenue: number }[];
  bySeller: { userId: string | null; name: string; count: number; revenue: number; utility: number }[];
  byClient: { clientId: string | null; name: string; count: number; revenue: number }[];
};

const EMPTY: SalesReport = {
  summary: { count: 0, revenue: 0, utility: 0, avgTicket: 0, marginPct: 0, costIncompleteCount: 0 },
  byDay: [], byProduct: [], bySeller: [], byClient: [],
};

export async function salesReport(sb: SupabaseClient, opts: { from: string; to: string; branchId?: string | null }): Promise<SalesReport> {
  try {
    const { from, to, branchId = null } = opts;
    let sq = sb.from("sales").select("id, created_by, client_id, total, tax_total, issued_at, clients(name)")
      .eq("status", "issued").gte("issued_at", from).lt("issued_at", addDays(to, 1));
    if (branchId) sq = sq.eq("branch_id", branchId);
    const { data: sales, error } = await sq;
    if (error || !sales || sales.length === 0) return EMPTY;

    const saleIds = sales.map((s: any) => s.id);
    const { data: items } = await sb.from("sale_items")
      .select("sale_id, product_id, description, quantity, unit_price, discount_pct, unit_cost").in("sale_id", saleIds);
    const creators = [...new Set(sales.map((s: any) => s.created_by).filter(Boolean))] as string[];
    const { data: profs } = creators.length
      ? await sb.from("profiles").select("id, full_name").in("id", creators)
      : { data: [] as any[] };
    const nameById = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));

    // costo por venta + completitud
    const costBySale = new Map<string, number>();
    const incompleteSale = new Set<string>();
    for (const it of items ?? []) {
      const prev = costBySale.get(it.sale_id) ?? 0;
      if (it.unit_cost == null) incompleteSale.add(it.sale_id);
      costBySale.set(it.sale_id, prev + (it.unit_cost != null ? Number(it.unit_cost) * Number(it.quantity) : 0));
    }

    let count = 0, revenue = 0, netRevenue = 0, utility = 0, costIncompleteCount = 0;
    const byDay = new Map<string, { date: string; revenue: number; utility: number }>();
    const bySeller = new Map<string, { userId: string | null; name: string; count: number; revenue: number; utility: number }>();
    const byClient = new Map<string, { clientId: string | null; name: string; count: number; revenue: number }>();

    for (const s of sales as any[]) {
      count++;
      const total = Number(s.total), net = total - Number(s.tax_total);
      const util = net - (costBySale.get(s.id) ?? 0);
      revenue += total; netRevenue += net; utility += util;
      if (incompleteSale.has(s.id)) costIncompleteCount++;
      const date = String(s.issued_at).slice(0, 10);
      const d = byDay.get(date) ?? { date, revenue: 0, utility: 0 }; d.revenue += total; d.utility += util; byDay.set(date, d);
      const sk = s.created_by ?? "none";
      const se = bySeller.get(sk) ?? { userId: s.created_by ?? null, name: nameById.get(s.created_by) || "—", count: 0, revenue: 0, utility: 0 };
      se.count++; se.revenue += total; se.utility += util; bySeller.set(sk, se);
      const ck = s.client_id ?? "none";
      const ce = byClient.get(ck) ?? { clientId: s.client_id ?? null, name: s.clients?.name ?? "Consumidor final", count: 0, revenue: 0 };
      ce.count++; ce.revenue += total; byClient.set(ck, ce);
    }

    const byProduct = new Map<string, { productId: string | null; name: string; qty: number; revenue: number }>();
    for (const it of items ?? []) {
      const key = it.product_id ?? `desc:${it.description}`;
      const rev = Number(it.quantity) * Number(it.unit_price) * (1 - Number(it.discount_pct) / 100);
      const e = byProduct.get(key) ?? { productId: it.product_id ?? null, name: it.description, qty: 0, revenue: 0 };
      e.qty += Number(it.quantity); e.revenue += rev; byProduct.set(key, e);
    }

    return {
      summary: {
        count, revenue: round2(revenue), utility: round2(utility),
        avgTicket: count ? round2(revenue / count) : 0,
        marginPct: netRevenue > 0 ? round2((utility / netRevenue) * 100) : 0,
        costIncompleteCount,
      },
      byDay: [...byDay.values()].map((d) => ({ date: d.date, revenue: round2(d.revenue), utility: round2(d.utility) })).sort((a, b) => (a.date < b.date ? -1 : 1)),
      byProduct: [...byProduct.values()].map((e) => ({ ...e, qty: round2(e.qty), revenue: round2(e.revenue) })).sort((a, b) => b.revenue - a.revenue),
      bySeller: [...bySeller.values()].map((e) => ({ ...e, revenue: round2(e.revenue), utility: round2(e.utility) })).sort((a, b) => b.revenue - a.revenue),
      byClient: [...byClient.values()].map((e) => ({ ...e, revenue: round2(e.revenue) })).sort((a, b) => b.revenue - a.revenue),
    };
  } catch { return EMPTY; }
}

export async function utilityThisMonth(sb: SupabaseClient): Promise<{ utility: number; costIncompleteCount: number }> {
  const r = await salesReport(sb, monthRange(new Date()));
  return { utility: r.summary.utility, costIncompleteCount: r.summary.costIncompleteCount };
}
export async function salesByDayThisWeek(sb: SupabaseClient): Promise<{ date: string; revenue: number; utility: number }[]> {
  return (await salesReport(sb, weekRange(new Date()))).byDay;
}
export async function topProductsThisMonth(sb: SupabaseClient, limit = 5): Promise<{ productId: string | null; name: string; qty: number; revenue: number }[]> {
  return (await salesReport(sb, monthRange(new Date()))).byProduct.slice(0, limit);
}
```

- [ ] **Step 2: Verificar tipos + commit**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

```bash
git add src/lib/reportes/queries.ts
git commit -m "feat(reportes): salesReport (resumen + desgloses) + wrappers dashboard"
```

---

## Task 5: Tests de integración

**Files:**
- Create: `tests/reportes.test.ts`

**Prerequisito:** `npx supabase db reset` aplicado.

- [ ] **Step 1: Escribir los tests**

```typescript
import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import type { SaleSaveInput } from "@/lib/ventas/schema";
import { createDraft, emitSale, voidSale } from "@/lib/ventas/mutations";
import { salesReport } from "@/lib/reportes/queries";

const WIDE = { from: "2000-01-01", to: "2100-01-01" };

async function makeTenant(name: string) {
  const u = await newUserClient();
  const { data: tenantId } = await u.client.rpc("bootstrap_tenant", {
    p_name: name, p_slug: `${name}-${Date.now()}-${Math.random()}`, p_full_name: name,
  });
  return { ...u, tenantId: tenantId as string };
}
async function mainBranch(t: Awaited<ReturnType<typeof makeTenant>>) {
  const { data } = await t.client.from("branches").select("id").eq("tenant_id", t.tenantId).eq("is_main", true).single();
  return data!.id as string;
}
async function makeProduct(t: any, over: Record<string, any> = {}) {
  const { data } = await t.client.from("products")
    .insert({ tenant_id: t.tenantId, kind: "good", name: "Café", price: 10, cost: 4, ...over }).select("id").single();
  return data!.id as string;
}
const saleOf = (branchId: string, items: SaleSaveInput["items"], clientId: string | null = null): SaleSaveInput =>
  ({ clientId, branchId, globalDiscountPct: 0, notes: undefined, items });

describe("reportes — snapshot de costo", () => {
  it("createDraft guarda unit_cost del producto; línea libre queda null", async () => {
    const a = await makeTenant("cost"); const b = await mainBranch(a); const p = await makeProduct(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, [
      { productId: p, description: "Café", quantity: 2, unitPrice: 10, discountPct: 0, taxRate: 16 },
      { productId: null, description: "Envío", quantity: 1, unitPrice: 5, discountPct: 0, taxRate: 0 },
    ]));
    const { data } = await a.client.from("sale_items").select("product_id, unit_cost").eq("sale_id", id);
    const conProd = data!.find((r: any) => r.product_id === p);
    const libre = data!.find((r: any) => r.product_id === null);
    expect(Number(conProd!.unit_cost)).toBe(4);
    expect(libre!.unit_cost).toBeNull();
  });
});

describe("reportes — salesReport", () => {
  it("resumen: revenue, utility, avgTicket, count; anulada no cuenta", async () => {
    const a = await makeTenant("rep"); const b = await mainBranch(a); const p = await makeProduct(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, [
      { productId: p, description: "Café", quantity: 2, unitPrice: 10, discountPct: 0, taxRate: 16 },
    ]));
    await emitSale(a.client, id, { paymentType: "contado", paymentMethod: "efectivo" });
    // total 23.2 (2*10 +16%), neto 20, costo 8 → utilidad 12
    let r = await salesReport(a.client, WIDE);
    expect(r.summary.count).toBe(1);
    expect(r.summary.revenue).toBe(23.2);
    expect(r.summary.utility).toBe(12);
    expect(r.summary.avgTicket).toBe(23.2);
    expect(r.summary.marginPct).toBe(60);
    expect(r.summary.costIncompleteCount).toBe(0);

    const id2 = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, [
      { productId: p, description: "Café", quantity: 1, unitPrice: 10, discountPct: 0, taxRate: 0 },
    ]));
    await emitSale(a.client, id2, { paymentType: "credito" });
    await voidSale(a.client, id2);
    r = await salesReport(a.client, WIDE);
    expect(r.summary.count).toBe(1); // la anulada no cuenta
  });

  it("costo incompleto cuando una línea no tiene costo", async () => {
    const a = await makeTenant("inc"); const b = await mainBranch(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, [
      { productId: null, description: "Servicio", quantity: 1, unitPrice: 50, discountPct: 0, taxRate: 0 },
    ]));
    await emitSale(a.client, id, { paymentType: "credito" });
    const r = await salesReport(a.client, WIDE);
    expect(r.summary.costIncompleteCount).toBe(1);
  });

  it("desgloses byProduct / bySeller / byClient", async () => {
    const a = await makeTenant("bd"); const b = await mainBranch(a); const p = await makeProduct(a);
    const { data: cli } = await a.client.from("clients").insert({ tenant_id: a.tenantId, kind: "person", name: "Ana" }).select("id").single();
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, [
      { productId: p, description: "Café", quantity: 3, unitPrice: 10, discountPct: 0, taxRate: 0 },
    ], cli!.id));
    await emitSale(a.client, id, { paymentType: "credito" });
    const r = await salesReport(a.client, WIDE);
    expect(r.byProduct[0]).toMatchObject({ productId: p, qty: 3, revenue: 30 });
    expect(r.bySeller[0]).toMatchObject({ userId: a.id, count: 1, revenue: 30 });
    expect(r.bySeller[0].name).toBe("bd"); // full_name del owner (bootstrap)
    expect(r.byClient[0]).toMatchObject({ clientId: cli!.id, name: "Ana", count: 1, revenue: 30 });
    expect(r.byDay).toHaveLength(1);
  });

  it("rango excluye ventas fuera de [from,to]", async () => {
    const a = await makeTenant("rg"); const b = await mainBranch(a); const p = await makeProduct(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, [
      { productId: p, description: "Café", quantity: 1, unitPrice: 10, discountPct: 0, taxRate: 0 },
    ]));
    await emitSale(a.client, id, { paymentType: "credito" });
    const r = await salesReport(a.client, { from: "2000-01-01", to: "2000-01-02" });
    expect(r.summary.count).toBe(0);
  });
});
```

- [ ] **Step 2: Correr los tests — deben pasar**

Run: `npx vitest run tests/reportes.test.ts`
Expected: PASS (todos).

- [ ] **Step 3: Commit**

```bash
git add tests/reportes.test.ts
git commit -m "test(reportes): integración snapshot de costo + salesReport + desgloses"
```

---

## Task 6: Componentes (period-selector + bar-chart)

**Files:**
- Create: `src/components/reportes/bar-chart.tsx`, `src/components/reportes/period-selector.tsx`

- [ ] **Step 1: bar-chart.tsx**

```tsx
import { formatMoney } from "@/lib/format";

export function BarChart({ data, currency }: { data: { label: string; value: number }[]; currency?: string }) {
  if (data.length === 0) return <p className="py-6 text-center text-sm text-[var(--text-soft)]">Sin datos en el período.</p>;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-14 shrink-0 text-[var(--text-soft)]">{d.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-[var(--bg)]">
            <div className="h-4 rounded bg-gradient-to-r from-[#0e7490] to-[#14b8a6]" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="w-24 shrink-0 text-right text-[var(--text)]">{currency ? formatMoney(d.value, currency) : d.value}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: period-selector.tsx**

```tsx
"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { presetRange, type Preset } from "@/lib/reportes/ranges";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "hoy", label: "Hoy" }, { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mes" }, { key: "mes_pasado", label: "Mes pasado" },
];

export function PeriodSelector({ branches, showBranch }: { branches: { id: string; name: string }[]; showBranch: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function push(next: URLSearchParams) { router.push(`${pathname}?${next.toString()}`); }
  function setPreset(p: Preset) {
    const r = presetRange(p, new Date());
    const n = new URLSearchParams(sp.toString());
    n.set("from", r.from); n.set("to", r.to);
    push(n);
  }
  function setDate(key: "from" | "to", val: string) {
    const n = new URLSearchParams(sp.toString());
    if (val) n.set(key, val); else n.delete(key);
    push(n);
  }
  function setBranch(val: string) {
    const n = new URLSearchParams(sp.toString());
    if (val) n.set("branch", val); else n.delete("branch");
    push(n);
  }

  const dateCls = "h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm text-[var(--text)]";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button key={p.key} onClick={() => setPreset(p.key)}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--bg)]">
            {p.label}
          </button>
        ))}
      </div>
      <input type="date" className={dateCls} defaultValue={sp.get("from") ?? ""} onChange={(e) => setDate("from", e.target.value)} />
      <span className="text-sm text-[var(--text-soft)]">–</span>
      <input type="date" className={dateCls} defaultValue={sp.get("to") ?? ""} onChange={(e) => setDate("to", e.target.value)} />
      {showBranch && (
        <select className={dateCls} defaultValue={sp.get("branch") ?? ""} onChange={(e) => setBranch(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos + commit**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

```bash
git add src/components/reportes/bar-chart.tsx src/components/reportes/period-selector.tsx
git commit -m "feat(reportes): componentes bar-chart y period-selector"
```

---

## Task 7: Página de reporte de Ventas

**Files:**
- Create: `src/app/(app)/reportes/ventas/page.tsx` (reemplaza el placeholder)

- [ ] **Step 1: Implementar**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenantCurrency } from "@/lib/productos/queries";
import { salesReport } from "@/lib/reportes/queries";
import { monthRange } from "@/lib/reportes/ranges";
import { canAccess, type Role } from "@/lib/auth/roles";
import { formatMoney } from "@/lib/format";
import { PeriodSelector } from "@/components/reportes/period-selector";
import { BarChart } from "@/components/reportes/bar-chart";

export default async function ReporteVentasPage({ searchParams }: {
  searchParams: Promise<{ from?: string; to?: string; branch?: string }>;
}) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canAccess(role, "reportes")) redirect("/dashboard");

  const def = monthRange(new Date());
  const from = sp.from || def.from;
  const to = sp.to || def.to;
  const isBackOffice = ["owner", "admin", "administrativo"].includes(role);

  const [report, currency, { data: branches }] = await Promise.all([
    salesReport(sb, { from, to, branchId: sp.branch || null }),
    getTenantCurrency(sb),
    sb.from("branches").select("id, name").order("is_main", { ascending: false }),
  ]);
  const s = report.summary;
  const dayBars = report.byDay.map((d) => ({ label: new Date(`${d.date}T00:00:00`).toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit" }), value: d.revenue }));

  const card = "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4";
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Reporte de ventas</h1>
      <PeriodSelector branches={(branches ?? []) as any} showBranch={isBackOffice} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Ventas" value={String(s.count)} />
        <Kpi label="Ingresos" value={formatMoney(s.revenue, currency)} />
        <Kpi label="Utilidad" value={formatMoney(s.utility, currency)} sub={`${s.marginPct}% margen`} />
        <Kpi label="Ticket promedio" value={formatMoney(s.avgTicket, currency)} />
      </div>
      {s.costIncompleteCount > 0 && (
        <p className="text-xs text-[var(--text-soft)]">{s.costIncompleteCount} venta(s) sin costo registrado — la utilidad puede estar sobreestimada.</p>
      )}

      {s.count === 0 ? (
        <p className="text-sm text-[var(--text-soft)]">No hay ventas en el período seleccionado.</p>
      ) : (
        <>
          <div className={card}>
            <p className="mb-3 text-sm font-bold text-[var(--text)]">Ventas por día</p>
            <BarChart data={dayBars} currency={currency} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className={card}>
              <p className="mb-3 text-sm font-bold text-[var(--text)]">Top productos</p>
              <SimpleTable rows={report.byProduct.slice(0, 10).map((p) => [p.name, String(p.qty), formatMoney(p.revenue, currency)])} head={["Producto", "Cant.", "Ingreso"]} />
            </div>
            <div className={card}>
              <p className="mb-3 text-sm font-bold text-[var(--text)]">Por vendedor</p>
              <SimpleTable rows={report.bySeller.map((v) => [v.name, String(v.count), formatMoney(v.revenue, currency), formatMoney(v.utility, currency)])} head={["Vendedor", "Ventas", "Ingreso", "Utilidad"]} />
            </div>
            <div className={card}>
              <p className="mb-3 text-sm font-bold text-[var(--text)]">Por cliente</p>
              <SimpleTable rows={report.byClient.slice(0, 10).map((c) => [c.name, String(c.count), formatMoney(c.revenue, currency)])} head={["Cliente", "Ventas", "Ingreso"]} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs text-[var(--text-soft)]">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-[var(--text)]">{value}</p>
      {sub && <p className="text-xs text-[var(--text-soft)]">{sub}</p>}
    </div>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: string[][] }) {
  if (rows.length === 0) return <p className="text-sm text-[var(--text-soft)]">Sin datos.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-soft)]">
          {head.map((h, i) => <th key={i} className={`py-1 font-medium ${i > 0 ? "text-right" : ""}`}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-[var(--border)]">
            {r.map((c, j) => <td key={j} className={`py-1.5 ${j > 0 ? "text-right text-[var(--text-soft)]" : "text-[var(--text)]"}`}>{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Verificar tipos + commit**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

```bash
git add "src/app/(app)/reportes/ventas/page.tsx"
git commit -m "feat(reportes): página de reporte de ventas (resumen + desgloses + barras)"
```

---

## Task 8: Dashboard (Utilidad del mes / Ventas de la semana / Top productos)

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Imports y datos**

Añadir imports (junto a los existentes):

```typescript
import { utilityThisMonth, salesByDayThisWeek, topProductsThisMonth } from "@/lib/reportes/queries";
import { BarChart } from "@/components/reportes/bar-chart";
```

Extender el `Promise.all` de inventario existente (o añadir uno nuevo tras él). Añadir después del bloque `invKpi`/`invBreakdown`:

```typescript
  const [util, weekDays, topProds] = await Promise.all([
    utilityThisMonth(supabase), salesByDayThisWeek(supabase), topProductsThisMonth(supabase, 5),
  ]);
  const utilidadMes = canManageProducts(role) && sKpi.monthTotal > 0 ? { value: formatMoney(util.utility, currency) } : {};
  const weekBars = weekDays.map((d) => ({ label: new Date(`${d.date}T00:00:00`).toLocaleDateString("es-VE", { weekday: "short" }), value: d.revenue }));
```

(`canManageProducts`, `sKpi`, `currency`, `formatMoney` ya están disponibles desde los Planes 6/7.)

- [ ] **Step 2: KPIs de Utilidad (móvil y escritorio)**

En el bloque móvil, cambiar:
```tsx
        <div className="col-span-2"><KpiCard icon={TrendingUp} label="Utilidad del mes" /></div>
```
por:
```tsx
        <div className="col-span-2"><KpiCard icon={TrendingUp} label="Utilidad del mes" value={utilidadMes.value} /></div>
```

En el bloque escritorio, cambiar:
```tsx
        <KpiCard icon={TrendingUp} label="Utilidad del mes" />
```
por:
```tsx
        <KpiCard icon={TrendingUp} label="Utilidad del mes" value={utilidadMes.value} />
```

- [ ] **Step 3: "Ventas de la semana" con barras reales**

Reemplazar:
```tsx
        <div className="lg:col-span-2"><ChartCard title="Ventas de la semana" icon={BarChart3} empty emptyHint="Aún no hay ventas registradas." /></div>
```
por:
```tsx
        <div className="lg:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="mb-3 text-sm font-bold text-[var(--text)]">Ventas de la semana</p>
          <BarChart data={weekBars} currency={currency} />
        </div>
```

- [ ] **Step 4: Widget "Top productos"**

En la fila de escritorio "Clientes por tipo + Productos por categoría" (`<div className="hidden gap-4 lg:grid lg:grid-cols-2">`), cambiar `lg:grid-cols-2` por `lg:grid-cols-3` y añadir, al final de ese `div` (después del widget "Productos por categoría"), un tercer widget:

```tsx
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="mb-3 text-sm font-bold text-[var(--text)]">Top productos</p>
          {topProds.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-soft)]">Aún sin ventas registradas.</p>
          ) : (
            <ul className="space-y-2">
              {topProds.map((p) => (
                <li key={p.productId ?? p.name} className="flex items-center justify-between text-sm">
                  <span className="truncate text-[var(--text)]">{p.name}</span>
                  <span className="font-semibold text-[var(--text)]">{formatMoney(p.revenue, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
```

- [ ] **Step 5: Verificar tipos + commit**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos. (Si `BarChart3` o `ChartCard` quedan sin uso tras el cambio, elimínalos de los imports.)

```bash
git add "src/app/(app)/dashboard/page.tsx"
git commit -m "feat(reportes): dashboard con Utilidad del mes, Ventas de la semana y Top productos"
```

---

## Task 9: Verificación final

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Suite completa**

Run: `npx vitest run`
Expected: PASS todos (previos + reportes; ventas/cobros/inventario/presupuestos verdes tras el cambio de `replaceItems`).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build exitoso, sin errores.

- [ ] **Step 3: E2E manual (checklist)**

`npm run dev`, como **owner**, con algunas ventas emitidas (productos con costo):
- `/reportes/ventas`: resumen (Ventas, Ingresos, **Utilidad + margen**, Ticket); cambiar presets (Hoy/Semana/Mes/Mes pasado) y el rango desde/hasta; filtro de sucursal. Ventas por día (barras). Top productos / Por vendedor / Por cliente.
- Emitir una venta con una línea de texto libre (sin producto) → aparece la nota "1 venta sin costo registrado".
- Dashboard: "Utilidad del mes" (con valor), "Ventas de la semana" (barras), "Top productos".

Role-gating (usuarios en `/configuracion/usuarios`):
- **vendedor/cajero/almacén:** `/reportes/ventas` redirige a `/dashboard`; en el dashboard "Utilidad del mes" les sale vacío (no ven costo).

- [ ] **Step 4: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "chore(reportes): ajustes finales tras verificación E2E"
```

---

## Notas de cierre

- **DRY:** reusa `round2`, `formatMoney`, `getTenantCurrency`, `KpiCard`, `EmptyState`, `canManageProducts`, `canAccess`. El `bar-chart` lo comparten reporte y dashboard.
- **YAGNI:** nada de export, librería de gráficos, comparativas ni SQL de agregación (ver "Fuera de alcance" del spec).
- **Seguridad:** el reporte es back-office (`canAccess reportes`); el KPI de utilidad se gatea a `canManageProducts` (ve costo). El costo se resuelve server-side en `replaceItems` (nunca viaja del cliente). Las queries degradan a estructura vacía ante error/permiso.
- **AGENTS.md:** Next.js custom; `searchParams` es Promise (por eso el `await`). No se usa `Date.now()`/`Math.random()` en asserts de tests (los helpers de rango reciben una fecha base).
- **Finish:** con la suite verde + build limpio, usar `superpowers:finishing-a-development-branch` para el merge a `master`.
```
