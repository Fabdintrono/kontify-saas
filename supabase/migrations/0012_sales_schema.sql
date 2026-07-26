-- 0012_sales_schema.sql
create type public.sale_status as enum ('draft','issued','void');

create table public.sale_counters (
  tenant_id   uuid primary key references public.tenants(id) on delete cascade,
  last_number bigint not null default 0
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  number bigint,
  branch_id uuid not null references public.branches(id) on delete restrict,
  client_id uuid references public.clients(id) on delete set null,
  status public.sale_status not null default 'draft',
  currency text not null,
  global_discount_pct numeric(5,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  payment_method text,
  issued_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sales_tenant_status on public.sales (tenant_id, status);
create index sales_tenant_client on public.sales (tenant_id, client_id);
create index sales_tenant_branch on public.sales (tenant_id, branch_id);
create unique index sales_tenant_number on public.sales (tenant_id, number) where number is not null;

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(14,2) not null,
  unit_price numeric(14,2) not null,
  discount_pct numeric(5,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  position int not null default 0
);
create index sale_items_sale on public.sale_items (sale_id);
