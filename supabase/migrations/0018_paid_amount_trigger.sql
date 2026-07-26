-- 0018_paid_amount_trigger.sql
create or replace function public.recompute_sale_paid_amount()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_sale uuid;
begin
  v_sale := coalesce(new.sale_id, old.sale_id);
  update public.sales s
    set paid_amount = coalesce((
      select sum(p.amount) from public.payments p
      where p.sale_id = v_sale and p.voided = false
    ), 0),
    updated_at = now()
  where s.id = v_sale;
  return null;
end; $$;

create trigger trg_recompute_paid_amount
  after insert or update or delete on public.payments
  for each row execute function public.recompute_sale_paid_amount();
