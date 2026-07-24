-- 0009_products_schema.sql
create type public.product_kind as enum ('good','service');

alter table public.tenants add column if not exists currency text not null default 'USD';

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index product_categories_tenant_lname on public.product_categories (tenant_id, lower(name));
create index product_categories_tenant on public.product_categories (tenant_id);

create table public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  rate numeric(5,2) not null default 0,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index tax_rates_tenant_lname on public.tax_rates (tenant_id, lower(name));
create index tax_rates_tenant on public.tax_rates (tenant_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind public.product_kind not null,
  name text not null,
  sku text,
  description text,
  category_id uuid references public.product_categories(id) on delete set null,
  price numeric(14,2) not null default 0,
  cost numeric(14,2),
  tax_rate_id uuid references public.tax_rates(id) on delete set null,
  unit text not null default 'unidad',
  active boolean not null default true,
  created_branch_id uuid references public.branches(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_tenant on public.products (tenant_id);
create index products_tenant_active on public.products (tenant_id, active);
create index products_tenant_category on public.products (tenant_id, category_id);
create unique index products_tenant_sku on public.products (tenant_id, lower(sku)) where sku is not null;
