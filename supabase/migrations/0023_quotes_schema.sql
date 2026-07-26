-- 0023_quotes_schema.sql
create type public.quote_status as enum ('draft','sent','accepted','rejected','converted');

create table public.quote_counters (
  tenant_id   uuid primary key references public.tenants(id) on delete cascade,
  last_number bigint not null default 0
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  number bigint,
  branch_id uuid not null references public.branches(id) on delete restrict,
  client_id uuid references public.clients(id) on delete set null,
  status public.quote_status not null default 'draft',
  currency text not null,
  global_discount_pct numeric(5,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  valid_until date,
  converted_sale_id uuid references public.sales(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quotes_tenant_status on public.quotes (tenant_id, status);
create index quotes_tenant_client on public.quotes (tenant_id, client_id);
create unique index quotes_tenant_number on public.quotes (tenant_id, number) where number is not null;

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(14,2) not null,
  unit_price numeric(14,2) not null,
  discount_pct numeric(5,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  position int not null default 0
);
create index quote_items_quote on public.quote_items (quote_id);
