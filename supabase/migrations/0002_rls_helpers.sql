-- 0002_rls_helpers.sql
-- SECURITY DEFINER: leen memberships saltándose RLS para evitar recursión en políticas.
create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.memberships where user_id = auth.uid() limit 1;
$$;

create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.memberships where user_id = auth.uid() limit 1;
$$;

revoke all on function public.current_tenant_id() from public;
revoke all on function public.current_user_role() from public;
grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
