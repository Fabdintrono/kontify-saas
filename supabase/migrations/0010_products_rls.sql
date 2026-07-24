-- 0010_products_rls.sql
alter table public.product_categories enable row level security;
alter table public.tax_rates          enable row level security;
alter table public.products           enable row level security;

-- Catálogos auxiliares: SELECT para todo el tenant; crear al vuelo los roles CRUD;
-- renombrar/desactivar/marcar default solo owner/admin.
create policy product_categories_select on public.product_categories
  for select using (tenant_id = public.current_tenant_id());
create policy product_categories_insert on public.product_categories
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','almacen'));
create policy product_categories_update on public.product_categories
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin'));

create policy tax_rates_select on public.tax_rates
  for select using (tenant_id = public.current_tenant_id());
create policy tax_rates_insert on public.tax_rates
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','almacen'));
create policy tax_rates_update on public.tax_rates
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin'));

-- products: SELECT visible a todo el tenant (catálogo en lectura para vendedor/cajero);
-- INSERT/UPDATE solo owner/admin/administrativo/almacen; sin DELETE (soft-delete con active).
create policy products_select on public.products
  for select using (tenant_id = public.current_tenant_id());
create policy products_insert on public.products
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','almacen'));
create policy products_update on public.products
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','almacen'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','almacen'));

grant select, insert, update on public.product_categories to authenticated;
grant select, insert, update on public.tax_rates          to authenticated;
grant select, insert, update on public.products           to authenticated;
