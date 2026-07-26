-- 0022_stock_trigger.sql
create or replace function public.apply_stock_movement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.stock_levels(tenant_id, product_id, branch_id, qty)
    values (new.tenant_id, new.product_id, new.branch_id, new.qty_delta)
    on conflict (product_id, branch_id) do update set qty = public.stock_levels.qty + new.qty_delta;
  return null;
end; $$;

create trigger trg_apply_stock_movement
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();
