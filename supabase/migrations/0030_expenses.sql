-- Gastos: lo que sale del negocio. Sin esto la utilidad que muestra el inicio es bruta
-- y no dice si se está ganando o perdiendo de verdad.
--
-- Dos tablas con papeles distintos:
--   expenses            lo que YA se pagó. Es el hecho.
--   recurring_expenses  los gastos fijos (alquiler, nómina, internet): una plantilla con
--                       su frecuencia y la próxima fecha. Al registrar el pago nace un
--                       `expenses` y la plantilla avanza a la siguiente fecha.
-- Separarlas evita el error clásico de tratar una previsión como si fuera un pago hecho.

create type expense_frequency as enum ('semanal', 'quincenal', 'mensual', 'bimestral', 'trimestral', 'anual');

create table public.expense_categories (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  name       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index expense_categories_tenant on public.expense_categories(tenant_id);

create table public.recurring_expenses (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  category_id uuid references public.expense_categories(id) on delete set null,
  description text not null,
  amount      numeric(14,2) not null check (amount > 0),
  currency    text not null,
  frequency   expense_frequency not null,
  -- Día del próximo pago. Es una fecha de calendario, no un instante: un alquiler
  -- vence el día 5, no a una hora.
  next_due    date not null,
  -- Día del mes que eligió el usuario. Sin guardarlo, un pago del 31 de enero se
  -- recorta al 28 de febrero y a partir de ahí se queda pegado al 28 para siempre.
  anchor_day  smallint not null check (anchor_day between 1 and 31),
  active      boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index recurring_expenses_tenant_due on public.recurring_expenses(tenant_id, next_due);

create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  branch_id    uuid references public.branches(id) on delete set null,
  category_id  uuid references public.expense_categories(id) on delete set null,
  -- De qué gasto fijo salió, si salió de uno. Sirve para no cobrar dos veces el mismo mes.
  recurring_id uuid references public.recurring_expenses(id) on delete set null,
  description  text not null,
  amount       numeric(14,2) not null check (amount > 0),
  currency     text not null,
  spent_on     date not null,
  payment_method text,
  supplier     text,
  notes        text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index expenses_tenant_date on public.expenses(tenant_id, spent_on desc);
create index expenses_tenant_category on public.expenses(tenant_id, category_id);
create index expenses_recurring on public.expenses(recurring_id) where recurring_id is not null;

-- RLS. Los gastos los ve y los toca el back-office: un vendedor no tiene por qué saber
-- cuánto cuesta el alquiler. Sin DELETE en los catálogos (se desactivan); los gastos sí
-- se pueden borrar porque un gasto mal cargado es ruido, no historia.
alter table public.expense_categories enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.expenses           enable row level security;

create policy expense_categories_select on public.expense_categories
  for select using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo'));
create policy expense_categories_insert on public.expense_categories
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo'));
create policy expense_categories_update on public.expense_categories
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin'));

create policy recurring_expenses_select on public.recurring_expenses
  for select using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo'));
create policy recurring_expenses_insert on public.recurring_expenses
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo'));
create policy recurring_expenses_update on public.recurring_expenses
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo'));
create policy recurring_expenses_delete on public.recurring_expenses
  for delete using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin'));

create policy expenses_select on public.expenses
  for select using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo'));
create policy expenses_insert on public.expenses
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo'));
create policy expenses_update on public.expenses
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo'));
create policy expenses_delete on public.expenses
  for delete using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin'));

grant select, insert, update         on public.expense_categories to authenticated;
grant select, insert, update, delete on public.recurring_expenses to authenticated;
grant select, insert, update, delete on public.expenses           to authenticated;

-- Categorías de salida de un negocio pequeño, para que nadie empiece con una lista vacía.
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
  insert into public.client_types(tenant_id, name)
    values (v_tenant, 'Minorista'), (v_tenant, 'Mayorista');
  insert into public.product_categories(tenant_id, name)
    values (v_tenant, 'General');
  insert into public.tax_rates(tenant_id, name, rate, is_default)
    values (v_tenant, 'IVA 16%', 16, true), (v_tenant, 'Exento 0%', 0, false);
  insert into public.expense_categories(tenant_id, name) values
    (v_tenant, 'Alquiler'), (v_tenant, 'Nómina'), (v_tenant, 'Servicios'),
    (v_tenant, 'Compra de mercancía'), (v_tenant, 'Transporte'),
    (v_tenant, 'Impuestos'), (v_tenant, 'Mantenimiento'), (v_tenant, 'Otros');

  return v_tenant;
end; $$;

revoke all on function public.bootstrap_tenant(text,text,text) from public;
grant execute on function public.bootstrap_tenant(text,text,text) to authenticated;
