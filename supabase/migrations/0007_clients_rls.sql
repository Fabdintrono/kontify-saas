-- 0007_clients_rls.sql
alter table public.client_types enable row level security;
alter table public.clients      enable row level security;

-- client_types: leer/crear (crear al vuelo) los 4 roles con acceso a Clientes; renombrar/desactivar solo owner/admin
create policy client_types_select on public.client_types
  for select using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor'));
create policy client_types_insert on public.client_types
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor'));
create policy client_types_update on public.client_types
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin'));

-- clients: leer/crear/editar los 4 roles con acceso; sin DELETE (soft-delete con active)
create policy clients_select on public.clients
  for select using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor'));
create policy clients_insert on public.clients
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor'));
create policy clients_update on public.clients
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor'));

grant select, insert, update on public.client_types to authenticated;
grant select, insert, update on public.clients      to authenticated;
