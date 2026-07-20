-- 0006_clients_schema.sql
create type public.client_kind as enum ('person','company');

create table public.client_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index client_types_tenant_lname on public.client_types (tenant_id, lower(name));
create index client_types_tenant on public.client_types (tenant_id);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind public.client_kind not null,
  name text not null,
  doc_id text,
  email text,
  phone text,
  address text,
  contact_name text,
  type_id uuid references public.client_types(id) on delete set null,
  notes text,
  active boolean not null default true,
  created_branch_id uuid references public.branches(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_tenant on public.clients (tenant_id);
create index clients_tenant_active on public.clients (tenant_id, active);
create index clients_tenant_type on public.clients (tenant_id, type_id);
