-- 0017_payments_rls.sql
alter table public.payments enable row level security;

-- Laxo: los 5 roles de venta pueden leer/insertar (para que el contado, emitido por
-- vendedor/cajero, cree su cobro). La barrera de abonos manuales vive en la Server Action.
create policy payments_select on public.payments
  for select using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));
create policy payments_insert on public.payments
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));
-- Anular (voided) solo owner/admin.
create policy payments_update on public.payments
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin'));

grant select, insert, update on public.payments to authenticated;
