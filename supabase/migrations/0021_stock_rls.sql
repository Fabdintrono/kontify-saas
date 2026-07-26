-- 0021_stock_rls.sql
alter table public.stock_movements enable row level security;
alter table public.stock_levels    enable row level security;

-- movimientos: SELECT scopeado por sucursal; INSERT laxo (los 6 roles, para el descuento por venta).
-- Sin UPDATE/DELETE (ledger append-only). La barrera de ajustes manuales vive en la Server Action.
create policy stock_movements_select on public.stock_movements
  for select using (tenant_id = public.current_tenant_id()
    and ( public.current_user_role() in ('owner','admin','administrativo')
          or branch_id = public.current_user_branch_id() ));
create policy stock_movements_insert on public.stock_movements
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero','almacen'));

-- niveles: solo lectura scopeada; los escribe el trigger (SECURITY DEFINER).
create policy stock_levels_select on public.stock_levels
  for select using (tenant_id = public.current_tenant_id()
    and ( public.current_user_role() in ('owner','admin','administrativo')
          or branch_id = public.current_user_branch_id() ));

grant select, insert on public.stock_movements to authenticated;
grant select on public.stock_levels to authenticated;
