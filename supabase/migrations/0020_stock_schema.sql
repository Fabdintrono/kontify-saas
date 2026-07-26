-- 0020_stock_schema.sql
create type public.stock_movement_type as enum ('adjustment','sale','sale_void');

alter table public.products add column min_stock numeric(14,2) not null default 0;

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  branch_id uuid not null references public.branches(id) on delete restrict,
  qty_delta numeric(14,2) not null,
  type public.stock_movement_type not null,
  sale_id uuid references public.sales(id) on delete set null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index stock_movements_tenant_product on public.stock_movements (tenant_id, product_id);
create index stock_movements_branch on public.stock_movements (branch_id);
create index stock_movements_sale on public.stock_movements (sale_id);

create table public.stock_levels (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  qty numeric(14,2) not null default 0,
  primary key (product_id, branch_id)
);
create index stock_levels_tenant on public.stock_levels (tenant_id);
