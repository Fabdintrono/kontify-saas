-- 0015_sales_branch_write_scope.sql
-- Cierra la brecha: la escritura de sales debe scopear por sucursal para operativos
-- (back-office puede en cualquier sucursal; vendedor/cajero solo en la suya).
drop policy sales_insert on public.sales;
create policy sales_insert on public.sales
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero')
    and ( public.current_user_role() in ('owner','admin','administrativo')
          or branch_id = public.current_user_branch_id() ));

drop policy sales_update on public.sales;
create policy sales_update on public.sales
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero')
    and ( public.current_user_role() in ('owner','admin','administrativo')
          or branch_id = public.current_user_branch_id() ))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero')
    and ( public.current_user_role() in ('owner','admin','administrativo')
          or branch_id = public.current_user_branch_id() ));
