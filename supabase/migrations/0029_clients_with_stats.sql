-- Vista de clientes con su valor comercial, para que la lista pueda ordenar por
-- «cuánto me compra» y no solo por nombre.
--
-- `security_invoker = true`: la vista NO salta las políticas. Lee con los permisos de
-- quien consulta, así que las políticas de `clients`, `sales` y `client_types` siguen
-- mandando y un tenant jamás ve filas de otro.
--
-- El `left join lateral` agrega solo las ventas emitidas: los borradores no son compras
-- y las anuladas dejaron de serlo.

create or replace view public.clients_with_stats
with (security_invoker = true) as
select
  c.id,
  c.tenant_id,
  c.kind,
  c.name,
  c.doc_id,
  c.email,
  c.phone,
  c.address,
  c.contact_name,
  c.notes,
  c.active,
  c.created_at,
  c.type_id,
  ct.name                                as type_name,
  coalesce(s.orders_count, 0)::int       as orders_count,
  coalesce(s.spent_total, 0)::numeric    as spent_total,
  s.last_order_at
from public.clients c
left join public.client_types ct on ct.id = c.type_id
left join lateral (
  select
    count(*)                                      as orders_count,
    sum(sa.total)                                 as spent_total,
    max(coalesce(sa.issued_at, sa.created_at))    as last_order_at
  from public.sales sa
  where sa.client_id = c.id and sa.status = 'issued'
) s on true;

grant select on public.clients_with_stats to authenticated;
