-- 0013_sales_rls.sql
-- Helper: sucursal del usuario actual (NULL para owner/admin/administrativo).
create or replace function public.current_user_branch_id()
returns uuid language sql stable security definer set search_path = public as $$
  select branch_id from public.memberships where user_id = auth.uid() limit 1;
$$;
revoke all on function public.current_user_branch_id() from public;
grant execute on function public.current_user_branch_id() to authenticated;

alter table public.sales      enable row level security;
alter table public.sale_items enable row level security;

-- sales: back-office ve todas; vendedor/cajero solo su sucursal. Escritura: roles de venta (almacén no).
create policy sales_select on public.sales
  for select using (tenant_id = public.current_tenant_id()
    and ( public.current_user_role() in ('owner','admin','administrativo')
          or branch_id = public.current_user_branch_id() ));
create policy sales_insert on public.sales
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));
create policy sales_update on public.sales
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));
create policy sales_delete on public.sales
  for delete using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));

-- sale_items: SELECT espeja la visibilidad por sucursal de la venta padre; escritura por rol de venta.
create policy sale_items_select on public.sale_items
  for select using (tenant_id = public.current_tenant_id()
    and exists ( select 1 from public.sales s where s.id = sale_id
      and ( public.current_user_role() in ('owner','admin','administrativo')
            or s.branch_id = public.current_user_branch_id() ) ));
create policy sale_items_insert on public.sale_items
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));
create policy sale_items_update on public.sale_items
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));
create policy sale_items_delete on public.sale_items
  for delete using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));

-- sale_counters: la RPC es SECURITY DEFINER, pero el on-conflict necesita permisos base.
alter table public.sale_counters enable row level security;
create policy sale_counters_all on public.sale_counters
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

grant select, insert, update, delete on public.sales      to authenticated;
grant select, insert, update, delete on public.sale_items to authenticated;
grant select, insert, update on public.sale_counters to authenticated;
