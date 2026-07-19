# Kontify Fundación — Plan 1: Multi-tenant + Auth + Subdominios

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el motor de datos y acceso de Kontify: un usuario se registra creando su empresa (tenant) con sucursal principal, inicia sesión, y RLS garantiza que jamás vea datos de otro tenant.

**Architecture:** Next.js App Router + Supabase (Postgres/Auth). Aislamiento por `tenant_id` en cada fila con Row Level Security. El registro crea tenant + sucursal principal + perfil + membership `owner` vía una función `SECURITY DEFINER`. Un middleware resuelve el tenant desde el subdominio (`cliente.kontify.app`) y refresca la sesión.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Tailwind CSS, `@supabase/supabase-js`, `@supabase/ssr`, Supabase CLI (Postgres + Auth local), Vitest para tests de integración.

**Alcance:** Este plan NO incluye el diseño visual (dual-tier, dashboard) — eso es el Plan 2. Aquí el `/dashboard` es un placeholder mínimo que prueba que auth + tenant + rol funcionan.

---

## Estructura de archivos

```
admin-saas/
├── supabase/
│   ├── config.toml                         # generado por `supabase init`
│   └── migrations/
│       ├── 0001_core_tenancy.sql           # tablas tenants/branches/profiles/memberships + enum
│       ├── 0002_rls_helpers.sql            # current_tenant_id(), current_user_role()
│       ├── 0003_rls_policies.sql           # políticas RLS por tabla
│       └── 0004_bootstrap_tenant.sql       # RPC de registro
├── src/
│   ├── lib/supabase/
│   │   ├── client.ts                       # cliente browser
│   │   ├── server.ts                       # cliente server (cookies)
│   │   └── admin.ts                        # cliente service-role (solo server/tests)
│   ├── lib/auth/
│   │   ├── roles.ts                        # tipos de rol + helpers de permiso
│   │   └── tenant-context.ts               # lectura del tenant desde headers
│   ├── app/
│   │   ├── (auth)/registro/page.tsx        # formulario de registro
│   │   ├── (auth)/login/page.tsx           # formulario de login
│   │   ├── dashboard/page.tsx              # placeholder protegido
│   │   └── api/registro/route.ts           # endpoint de registro (signup + bootstrap)
│   └── middleware.ts                        # refresco de sesión + resolución de subdominio
├── tests/
│   ├── setup.ts                            # helpers: crear usuario, cliente autenticado
│   ├── rls.test.ts                         # aislamiento entre tenants
│   ├── bootstrap.test.ts                   # registro crea tenant/branch/owner
│   └── roles.test.ts                       # helpers de permisos
├── tailwind.config.ts                      # tokens Teal & Slate (config solamente)
├── .env.local                              # claves Supabase (gitignored)
└── vitest.config.ts
```

**Responsabilidades:** cada migración es un cambio atómico de esquema. `lib/supabase/*` aísla la creación de clientes. `lib/auth/*` centraliza roles y contexto de tenant. Los tests de integración corren contra Supabase local.

---

## Prerequisitos (Task 0)

- [ ] **Step 1: Verificar herramientas**

Run:
```bash
node --version   # >= 20
npx supabase --version || npm i -g supabase
```
Expected: versiones impresas, Supabase CLI disponible.

- [ ] **Step 2: Confirmar que estamos en el repo**

Run: `cd ~/admin-saas && git status`
Expected: repo limpio en `main` (commit `9893d4a` de docs).

---

## Task 1: Scaffold Next.js + Supabase local

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `supabase/config.toml`
- Create: `.env.local`, actualizar `.gitignore`

- [ ] **Step 1: Crear la app Next.js en el directorio actual**

Run:
```bash
cd ~/admin-saas
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --use-npm --yes
```
Expected: scaffold creado en `src/`. Si pregunta por sobrescribir `README.md`/`.gitignore`, responder que NO sobrescriba (mantener los nuestros) o restaurarlos después con `git checkout README.md .gitignore`.

- [ ] **Step 2: Restaurar nuestros archivos de docs si el scaffold los tocó**

Run: `git checkout -- README.md .gitignore docs/ 2>/dev/null; git status`
Expected: `docs/`, `README.md`, `.gitignore` intactos.

- [ ] **Step 3: Instalar dependencias del proyecto**

Run:
```bash
npm i @supabase/supabase-js @supabase/ssr
npm i -D vitest @vitejs/plugin-react dotenv
```
Expected: instalación sin errores.

- [ ] **Step 4: Inicializar Supabase local y arrancarlo**

Run:
```bash
npx supabase init
npx supabase start
```
Expected: imprime `API URL`, `anon key`, `service_role key`, `DB URL`. Guardar esos valores.

- [ ] **Step 5: Escribir `.env.local`**

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key del step 4>
SUPABASE_SERVICE_ROLE_KEY=<service_role key del step 4>
NEXT_PUBLIC_ROOT_DOMAIN=lvh.me:3000
```
(`lvh.me` resuelve a 127.0.0.1 incluyendo subdominios — sirve para probar `acme.lvh.me:3000` en local.)

- [ ] **Step 6: Asegurar `.gitignore` cubre secretos**

Verificar que `.gitignore` contiene `.env*` y `.superpowers/`. Si falta, añadir.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Supabase local"
```

---

## Task 2: Tokens de tema Teal & Slate

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Definir la paleta en Tailwind**

En `tailwind.config.ts`, dentro de `theme.extend.colors`, añadir (valores de `docs/design/design-system.md`):

```ts
colors: {
  brand: {
    DEFAULT: "#0e7490",
    light: "#14b8a6",
    accent: "#2dd4bf",
  },
  ink: { DEFAULT: "#0f172a", soft: "#64748b" },
},
```
Y habilitar dark mode por clase: añadir `darkMode: "class"` en la raíz de la config.

- [ ] **Step 2: Variables CSS base claro/oscuro**

En `src/app/globals.css`, tras las directivas de Tailwind, añadir:

```css
:root {
  --bg: #f1f5f9; --surface: #ffffff; --border: #e8edf2;
  --text: #0f172a; --text-soft: #64748b;
}
.dark {
  --bg: #0b1220; --surface: #111c30; --border: #26334a;
  --text: #e2e8f0; --text-soft: #94a3b8;
}
body { background: var(--bg); color: var(--text); }
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build OK (sin errores de Tailwind).

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts src/app/globals.css
git commit -m "feat: Teal & Slate design tokens + dark mode base"
```

---

## Task 3: Esquema núcleo de tenancy

**Files:**
- Create: `supabase/migrations/0001_core_tenancy.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 0001_core_tenancy.sql
create type public.user_role as enum
  ('owner','admin','administrativo','vendedor','cajero','almacen');

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  is_main boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role public.user_role not null,
  branch_id uuid references public.branches(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);

create index on public.branches (tenant_id);
create index on public.memberships (user_id);
create index on public.memberships (tenant_id);
```

- [ ] **Step 2: Aplicar la migración a la BD local**

Run: `npx supabase migration up`
Expected: `Applying migration 0001_core_tenancy.sql...` sin errores.

- [ ] **Step 3: Verificar las tablas**

Run: `npx supabase db diff --schema public | head`
Expected: sin diferencias pendientes (esquema aplicado).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_core_tenancy.sql
git commit -m "feat(db): core tenancy schema (tenants, branches, profiles, memberships)"
```

---

## Task 4: Helpers RLS (tenant y rol actuales)

**Files:**
- Create: `supabase/migrations/0002_rls_helpers.sql`

- [ ] **Step 1: Escribir las funciones**

```sql
-- 0002_rls_helpers.sql
-- SECURITY DEFINER: leen memberships saltándose RLS para evitar recursión en políticas.
create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.memberships where user_id = auth.uid() limit 1;
$$;

create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.memberships where user_id = auth.uid() limit 1;
$$;

revoke all on function public.current_tenant_id() from public;
revoke all on function public.current_user_role() from public;
grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
```

- [ ] **Step 2: Aplicar**

Run: `npx supabase migration up`
Expected: aplicada sin errores.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_rls_helpers.sql
git commit -m "feat(db): RLS helper functions current_tenant_id/current_user_role"
```

---

## Task 5: Políticas RLS

**Files:**
- Create: `supabase/migrations/0003_rls_policies.sql`

- [ ] **Step 1: Escribir las políticas**

```sql
-- 0003_rls_policies.sql
alter table public.tenants     enable row level security;
alter table public.branches    enable row level security;
alter table public.profiles    enable row level security;
alter table public.memberships enable row level security;

-- tenants: ver/actualizar solo el propio; owner/admin puede actualizar
create policy tenants_select on public.tenants
  for select using (id = public.current_tenant_id());
create policy tenants_update on public.tenants
  for update using (id = public.current_tenant_id()
                    and public.current_user_role() in ('owner','admin'));

-- branches: ver las del tenant; gestionar solo owner/admin
create policy branches_select on public.branches
  for select using (tenant_id = public.current_tenant_id());
create policy branches_write on public.branches
  for all using (tenant_id = public.current_tenant_id()
                 and public.current_user_role() in ('owner','admin'))
  with check (tenant_id = public.current_tenant_id()
              and public.current_user_role() in ('owner','admin'));

-- profiles: ver los del tenant; editar el propio
create policy profiles_select on public.profiles
  for select using (tenant_id = public.current_tenant_id());
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- memberships: ver las del tenant; gestionar owner/admin
create policy memberships_select on public.memberships
  for select using (tenant_id = public.current_tenant_id());
create policy memberships_write on public.memberships
  for all using (tenant_id = public.current_tenant_id()
                 and public.current_user_role() in ('owner','admin'))
  with check (tenant_id = public.current_tenant_id()
              and public.current_user_role() in ('owner','admin'));
```

- [ ] **Step 2: Aplicar**

Run: `npx supabase migration up`
Expected: aplicada sin errores.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_rls_policies.sql
git commit -m "feat(db): RLS policies for tenant isolation"
```

---

## Task 6: RPC de registro `bootstrap_tenant`

**Files:**
- Create: `supabase/migrations/0004_bootstrap_tenant.sql`

- [ ] **Step 1: Escribir la función**

```sql
-- 0004_bootstrap_tenant.sql
create or replace function public.bootstrap_tenant(
  p_name text, p_slug text, p_full_name text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_branch uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.memberships where user_id = auth.uid()) then
    raise exception 'user already belongs to a tenant';
  end if;

  insert into public.tenants(name, slug) values (p_name, lower(p_slug))
    returning id into v_tenant;
  insert into public.branches(tenant_id, name, is_main)
    values (v_tenant, 'Principal', true) returning id into v_branch;
  insert into public.profiles(id, tenant_id, full_name)
    values (auth.uid(), v_tenant, coalesce(p_full_name, ''));
  insert into public.memberships(user_id, tenant_id, role, branch_id)
    values (auth.uid(), v_tenant, 'owner', null);

  return v_tenant;
end; $$;

revoke all on function public.bootstrap_tenant(text,text,text) from public;
grant execute on function public.bootstrap_tenant(text,text,text) to authenticated;
```

- [ ] **Step 2: Aplicar**

Run: `npx supabase migration up`
Expected: aplicada sin errores.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_bootstrap_tenant.sql
git commit -m "feat(db): bootstrap_tenant RPC (create tenant + branch + owner)"
```

---

## Task 7: Configurar Vitest + helpers de test

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`
- Modify: `package.json` (script `test`)

- [ ] **Step 1: `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "node", setupFiles: [], testTimeout: 20000 },
});
```

- [ ] **Step 2: Helpers de test**

`tests/setup.ts`:
```ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import "dotenv/config";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let counter = 0;
/** Crea un usuario confirmado y devuelve un cliente autenticado como él. */
export async function newUserClient(): Promise<{ client: SupabaseClient; email: string; id: string }> {
  const email = `u${Date.now()}_${counter++}@test.dev`;
  const password = "test-password-123";
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw error;
  const client = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  return { client, email, id: data.user!.id };
}
```

- [ ] **Step 3: Añadir script de test**

En `package.json`, en `scripts`: `"test": "vitest run"`.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts tests/setup.ts package.json
git commit -m "test: vitest setup + authenticated client helper"
```

---

## Task 8: Test de registro (bootstrap crea tenant/branch/owner)

**Files:**
- Create: `tests/bootstrap.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";

describe("bootstrap_tenant", () => {
  it("crea tenant + sucursal principal + membership owner", async () => {
    const { client, id } = await newUserClient();
    const { data: tenantId, error } = await client.rpc("bootstrap_tenant", {
      p_name: "Acme", p_slug: `acme-${Date.now()}`, p_full_name: "Dueño Uno",
    });
    expect(error).toBeNull();
    expect(tenantId).toBeTruthy();

    const { data: branches } = await client.from("branches").select("*");
    expect(branches).toHaveLength(1);
    expect(branches![0].is_main).toBe(true);

    const { data: memberships } = await client.from("memberships").select("*");
    expect(memberships).toHaveLength(1);
    expect(memberships![0].role).toBe("owner");
    expect(memberships![0].user_id).toBe(id);
  });

  it("rechaza un segundo tenant para el mismo usuario", async () => {
    const { client } = await newUserClient();
    await client.rpc("bootstrap_tenant", { p_name: "A", p_slug: `a-${Date.now()}`, p_full_name: "x" });
    const { error } = await client.rpc("bootstrap_tenant", {
      p_name: "B", p_slug: `b-${Date.now()}`, p_full_name: "y",
    });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar — debe fallar si algo del esquema está mal, o pasar si Tasks 3–6 quedaron bien**

Run: `npm test -- tests/bootstrap.test.ts`
Expected: PASS (las migraciones ya implementan el comportamiento). Si falla, corregir la migración señalada por el error y re-aplicar con `npx supabase migration up`.

- [ ] **Step 3: Commit**

```bash
git add tests/bootstrap.test.ts
git commit -m "test: bootstrap_tenant creates tenant/branch/owner"
```

---

## Task 9: Test de aislamiento RLS entre tenants

**Files:**
- Create: `tests/rls.test.ts`

- [ ] **Step 1: Escribir el test**

```ts
import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";

async function makeTenant(name: string) {
  const u = await newUserClient();
  const { data: tenantId } = await u.client.rpc("bootstrap_tenant", {
    p_name: name, p_slug: `${name}-${Date.now()}-${Math.random()}`, p_full_name: name,
  });
  return { ...u, tenantId };
}

describe("RLS tenant isolation", () => {
  it("un tenant no ve las sucursales de otro", async () => {
    const a = await makeTenant("aa");
    const b = await makeTenant("bb");

    const { data: aBranches } = await a.client.from("branches").select("*");
    const { data: bBranches } = await b.client.from("branches").select("*");

    expect(aBranches).toHaveLength(1);
    expect(bBranches).toHaveLength(1);
    expect(aBranches![0].tenant_id).not.toBe(bBranches![0].tenant_id);
  });

  it("un tenant no puede leer el tenant de otro por id", async () => {
    const a = await makeTenant("cc");
    const b = await makeTenant("dd");
    const { data } = await b.client.from("tenants").select("*").eq("id", a.tenantId);
    expect(data).toHaveLength(0); // RLS lo filtra
  });

  it("un usuario sin tenant no ve nada", async () => {
    const { client } = await newUserClient();
    const { data } = await client.from("branches").select("*");
    expect(data).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Ejecutar**

Run: `npm test -- tests/rls.test.ts`
Expected: PASS. Si alguna consulta cruza tenants, revisar `0003_rls_policies.sql`.

- [ ] **Step 3: Commit**

```bash
git add tests/rls.test.ts
git commit -m "test: RLS blocks cross-tenant reads"
```

---

## Task 10: Clientes Supabase (browser / server / admin)

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`

- [ ] **Step 1: Cliente browser**

`src/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr";
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 2: Cliente server (cookies)**

`src/lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* Server Component: ignora, el middleware refresca */ }
        },
      },
    },
  );
}
```

- [ ] **Step 3: Cliente admin (solo server/tests)**

`src/lib/supabase/admin.ts`:
```ts
import { createClient } from "@supabase/supabase-js";
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
```

- [ ] **Step 4: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase
git commit -m "feat: supabase browser/server/admin clients"
```

---

## Task 11: Roles y permisos

**Files:**
- Create: `src/lib/auth/roles.ts`, `tests/roles.test.ts`

- [ ] **Step 1: Escribir el test**

`tests/roles.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { canAccess, isBranchScoped, ROLES } from "@/lib/auth/roles";

describe("roles", () => {
  it("owner y admin acceden a todo", () => {
    expect(canAccess("owner", "billing")).toBe(true);
    expect(canAccess("admin", "finanzas")).toBe(true);
  });
  it("administrativo entra a finanzas pero no a caja ni billing", () => {
    expect(canAccess("administrativo", "finanzas")).toBe(true);
    expect(canAccess("administrativo", "caja")).toBe(false);
    expect(canAccess("administrativo", "billing")).toBe(false);
  });
  it("cajero/vendedor/almacen están scoped a sucursal", () => {
    expect(isBranchScoped("cajero")).toBe(true);
    expect(isBranchScoped("vendedor")).toBe(true);
    expect(isBranchScoped("almacen")).toBe(true);
    expect(isBranchScoped("owner")).toBe(false);
  });
  it("ROLES lista los 6 roles de tenant", () => {
    expect(ROLES).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Ejecutar — debe fallar (módulo no existe)**

Run: `npm test -- tests/roles.test.ts`
Expected: FAIL con "Cannot find module '@/lib/auth/roles'".

- [ ] **Step 3: Implementar**

`src/lib/auth/roles.ts`:
```ts
export const ROLES = ["owner","admin","administrativo","vendedor","cajero","almacen"] as const;
export type Role = (typeof ROLES)[number];

/** Recursos de alto nivel usados para gatear acceso. */
export type Resource = "billing" | "finanzas" | "caja" | "operaciones" | "reportes" | "clientes";

const BRANCH_SCOPED: Role[] = ["vendedor", "cajero", "almacen"];
export const isBranchScoped = (r: Role) => BRANCH_SCOPED.includes(r);

export function canAccess(role: Role, resource: Resource): boolean {
  if (role === "owner" || role === "admin") return true;
  if (role === "administrativo") {
    return ["finanzas", "operaciones", "reportes", "clientes"].includes(resource);
  }
  // operativos: acceso a operaciones/caja según corresponda (se refina por módulo)
  if (role === "cajero") return resource === "caja" || resource === "operaciones";
  if (role === "vendedor") return resource === "operaciones" || resource === "clientes";
  if (role === "almacen") return resource === "operaciones";
  return false;
}
```

- [ ] **Step 4: Ejecutar — debe pasar**

Run: `npm test -- tests/roles.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/roles.ts tests/roles.test.ts
git commit -m "feat: role/permission helpers with tests"
```

---

## Task 12: Middleware — refresco de sesión + resolución de subdominio

**Files:**
- Create: `src/middleware.ts`, `src/lib/auth/tenant-context.ts`

- [ ] **Step 1: Middleware**

`src/middleware.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });

  // Refrescar sesión (cookies)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );
  await supabase.auth.getUser();

  // Resolver subdominio → x-tenant-slug
  const host = req.headers.get("host") ?? "";
  const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").split(":")[0];
  const hostname = host.split(":")[0];
  let slug = "";
  if (root && hostname.endsWith(root) && hostname !== root) {
    slug = hostname.slice(0, hostname.length - root.length - 1); // "acme" de "acme.lvh.me"
  }
  res.headers.set("x-tenant-slug", slug);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 2: Helper de contexto de tenant**

`src/lib/auth/tenant-context.ts`:
```ts
import { headers } from "next/headers";

/** Slug del tenant resuelto por el middleware desde el subdominio (o "" en el dominio raíz). */
export async function getTenantSlug(): Promise<string> {
  const h = await headers();
  return h.get("x-tenant-slug") ?? "";
}
```

- [ ] **Step 3: Verificar typecheck y build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts src/lib/auth/tenant-context.ts
git commit -m "feat: middleware session refresh + subdomain tenant resolution"
```

---

## Task 13: Registro (UI + endpoint)

**Files:**
- Create: `src/app/api/registro/route.ts`, `src/app/(auth)/registro/page.tsx`

- [ ] **Step 1: Endpoint de registro**

`src/app/api/registro/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { email, password, fullName, companyName, slug } = await req.json();
  if (!email || !password || !companyName || !slug) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }
  const supabase = await createClient();

  const { error: signUpErr } = await supabase.auth.signUp({ email, password });
  if (signUpErr) return NextResponse.json({ error: signUpErr.message }, { status: 400 });

  // La sesión ya está activa (email confirm off en local). Crear el tenant.
  const { data: tenantId, error: rpcErr } = await supabase.rpc("bootstrap_tenant", {
    p_name: companyName, p_slug: slug, p_full_name: fullName ?? "",
  });
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 400 });

  return NextResponse.json({ tenantId, slug });
}
```

- [ ] **Step 2: Página de registro (mínima, se estiliza en Plan 2)**

`src/app/(auth)/registro/page.tsx`:
```tsx
"use client";
import { useState } from "react";

export default function Registro() {
  const [form, setForm] = useState({ email: "", password: "", fullName: "", companyName: "", slug: "" });
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Creando…");
    const r = await fetch("/api/registro", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const data = await r.json();
    setMsg(r.ok ? `Listo. Tu espacio: ${data.slug}.kontify.app` : `Error: ${data.error}`);
    if (r.ok) window.location.href = "/dashboard";
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm p-6 space-y-3">
      <h1 className="text-xl font-bold">Crear cuenta Kontify</h1>
      <input className="w-full border rounded p-2" placeholder="Empresa" value={form.companyName} onChange={set("companyName")} />
      <input className="w-full border rounded p-2" placeholder="subdominio (ej. acme)" value={form.slug} onChange={set("slug")} />
      <input className="w-full border rounded p-2" placeholder="Tu nombre" value={form.fullName} onChange={set("fullName")} />
      <input className="w-full border rounded p-2" placeholder="Email" type="email" value={form.email} onChange={set("email")} />
      <input className="w-full border rounded p-2" placeholder="Contraseña" type="password" value={form.password} onChange={set("password")} />
      <button className="w-full bg-brand text-white rounded p-2 font-semibold">Crear</button>
      <p className="text-sm text-ink-soft">{msg}</p>
    </form>
  );
}
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 4: Prueba manual**

Run: `npm run dev`, abrir `http://lvh.me:3000/registro`, crear "Acme" con slug "acme". Debe redirigir a `/dashboard`.
Expected: redirección sin error.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/registro/route.ts "src/app/(auth)/registro/page.tsx"
git commit -m "feat: tenant registration (signup + bootstrap)"
```

---

## Task 14: Login + Dashboard placeholder protegido

**Files:**
- Create: `src/app/(auth)/login/page.tsx`, `src/app/dashboard/page.tsx`

- [ ] **Step 1: Página de login**

`src/app/(auth)/login/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMsg(error.message); return; }
    window.location.href = "/dashboard";
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm p-6 space-y-3">
      <h1 className="text-xl font-bold">Entrar a Kontify</h1>
      <input className="w-full border rounded p-2" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="w-full border rounded p-2" placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button className="w-full bg-brand text-white rounded p-2 font-semibold">Entrar</button>
      <p className="text-sm text-ink-soft">{msg}</p>
    </form>
  );
}
```

- [ ] **Step 2: Dashboard placeholder (protegido, muestra tenant/rol)**

`src/app/dashboard/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("role, tenant_id, tenants(name, slug)")
    .single();

  const { data: branches } = await supabase.from("branches").select("name, is_main");

  return (
    <main className="p-8 space-y-2">
      <h1 className="text-2xl font-bold">Dashboard (placeholder)</h1>
      <p>Usuario: {user.email}</p>
      <p>Empresa: {(membership as any)?.tenants?.name} ({(membership as any)?.tenants?.slug}.kontify.app)</p>
      <p>Rol: {membership?.role}</p>
      <p>Sucursales: {branches?.map((b) => b.name).join(", ")}</p>
      <p className="text-ink-soft text-sm">El shell dual-tier y el dashboard real llegan en el Plan 2.</p>
    </main>
  );
}
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 4: Prueba manual end-to-end**

Con `npm run dev`: registrar un tenant, cerrar sesión (o incógnito), ir a `/login`, entrar, y ver el `/dashboard` con empresa + rol `owner` + sucursal "Principal". Intentar `/dashboard` sin sesión → redirige a `/login`.
Expected: flujo completo funciona; sin sesión redirige.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(auth)/login/page.tsx" src/app/dashboard/page.tsx
git commit -m "feat: login + protected dashboard placeholder"
```

---

## Task 15: Verificación final del Plan 1

- [ ] **Step 1: Toda la suite de tests pasa**

Run: `npm test`
Expected: PASS en `bootstrap.test.ts`, `rls.test.ts`, `roles.test.ts`.

- [ ] **Step 2: Build limpio**

Run: `npm run build`
Expected: sin errores ni warnings de tipos.

- [ ] **Step 3: Checklist de criterios de éxito**

Verificar manualmente:
- Un tenant nuevo se registra y obtiene su slug de subdominio.
- Login resuelve el usuario; `/dashboard` muestra su tenant/rol.
- RLS impide cruce de datos (cubierto por `rls.test.ts`).
- `/dashboard` sin sesión → `/login`.

- [ ] **Step 4: Commit de cierre (si hubo ajustes)**

```bash
git add -A
git commit -m "chore: Plan 1 fundación multitenant/auth complete"
```

---

## Notas para el Plan 2 (no implementar aquí)

- Sistema de diseño completo (dual-tier, dashboard, theme toggle, mobile nav, FAB squircle) sobre este motor.
- `/dashboard` real reemplaza el placeholder.
- Antes de producción: cambiar la política de confirmación de email en Supabase (en local está off), registrar el dominio `kontify.app` con wildcard DNS, y pasar la revisión de seguridad (agente full-stack senior) sobre RLS, endpoints y exposición del front.
