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
