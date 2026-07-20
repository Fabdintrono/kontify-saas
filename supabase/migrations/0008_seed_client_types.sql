-- 0008_seed_client_types.sql
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

  return v_tenant;
end; $$;

revoke all on function public.bootstrap_tenant(text,text,text) from public;
grant execute on function public.bootstrap_tenant(text,text,text) to authenticated;
