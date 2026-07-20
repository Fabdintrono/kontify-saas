-- 0003_rls_policies.sql
alter table public.tenants     enable row level security;
alter table public.branches    enable row level security;
alter table public.profiles    enable row level security;
alter table public.memberships enable row level security;

-- tenants: ver/actualizar solo el propio; owner/admin puede actualizar
create policy tenants_select on public.tenants
  for select using (id = public.current_tenant_id());
create policy tenants_update on public.tenants
  for update using (id = public.current_tenant_id()
                    and public.current_user_role() in ('owner','admin'));

-- branches: ver las del tenant; gestionar solo owner/admin
create policy branches_select on public.branches
  for select using (tenant_id = public.current_tenant_id());
create policy branches_write on public.branches
  for all using (tenant_id = public.current_tenant_id()
                 and public.current_user_role() in ('owner','admin'))
  with check (tenant_id = public.current_tenant_id()
              and public.current_user_role() in ('owner','admin'));

-- profiles: ver los del tenant; editar el propio
create policy profiles_select on public.profiles
  for select using (tenant_id = public.current_tenant_id());
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- memberships: ver las del tenant; gestionar owner/admin
create policy memberships_select on public.memberships
  for select using (tenant_id = public.current_tenant_id());
create policy memberships_write on public.memberships
  for all using (tenant_id = public.current_tenant_id()
                 and public.current_user_role() in ('owner','admin'))
  with check (tenant_id = public.current_tenant_id()
              and public.current_user_role() in ('owner','admin'));
