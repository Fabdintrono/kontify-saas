-- 0016_payments_schema.sql
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  amount numeric(14,2) not null,
  method text,
  reference text,
  paid_at date not null default current_date,
  voided boolean not null default false,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index payments_tenant on public.payments (tenant_id);
create index payments_sale on public.payments (sale_id);

alter table public.sales add column due_date date;
alter table public.sales add column balance numeric(14,2)
  generated always as (total - paid_amount) stored;
create index sales_tenant_balance on public.sales (tenant_id, balance);
