-- 0025_quote_number_rpc.sql
create or replace function public.next_quote_number()
returns bigint language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_num bigint;
begin
  v_tenant := public.current_tenant_id();
  if v_tenant is null then raise exception 'no tenant'; end if;
  insert into public.quote_counters(tenant_id, last_number)
    values (v_tenant, 1)
    on conflict (tenant_id) do update set last_number = public.quote_counters.last_number + 1
    returning last_number into v_num;
  return v_num;
end; $$;

revoke all on function public.next_quote_number() from public;
grant execute on function public.next_quote_number() to authenticated;
