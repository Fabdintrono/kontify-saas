-- 0024_quotes_rls.sql
-- (current_user_branch_id() ya existe desde 0013). Scoping por sucursal como en sales.
alter table public.quotes         enable row level security;
alter table public.quote_items    enable row level security;
alter table public.quote_counters enable row level security;

create policy quotes_select on public.quotes
  for select using (tenant_id = public.current_tenant_id()
    and ( public.current_user_role() in ('owner','admin','administrativo')
          or branch_id = public.current_user_branch_id() ));
create policy quotes_insert on public.quotes
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero')
    and ( public.current_user_role() in ('owner','admin','administrativo')
          or branch_id = public.current_user_branch_id() ));
create policy quotes_update on public.quotes
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero')
    and ( public.current_user_role() in ('owner','admin','administrativo')
          or branch_id = public.current_user_branch_id() ))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero')
    and ( public.current_user_role() in ('owner','admin','administrativo')
          or branch_id = public.current_user_branch_id() ));
create policy quotes_delete on public.quotes
  for delete using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero')
    and ( public.current_user_role() in ('owner','admin','administrativo')
          or branch_id = public.current_user_branch_id() ));

-- quote_items: SELECT espeja la visibilidad por sucursal del presupuesto padre.
create policy quote_items_select on public.quote_items
  for select using (tenant_id = public.current_tenant_id()
    and exists ( select 1 from public.quotes q where q.id = quote_id
      and ( public.current_user_role() in ('owner','admin','administrativo')
            or q.branch_id = public.current_user_branch_id() ) ));
create policy quote_items_insert on public.quote_items
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));
create policy quote_items_update on public.quote_items
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));
create policy quote_items_delete on public.quote_items
  for delete using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));

create policy quote_counters_all on public.quote_counters
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

grant select, insert, update, delete on public.quotes      to authenticated;
grant select, insert, update, delete on public.quote_items to authenticated;
grant select, insert, update on public.quote_counters to authenticated;
